import {
  CreateCollectionCommand,
  CreateFaceLivenessSessionCommand,
  DeleteFacesCommand,
  DescribeCollectionCommand,
  GetFaceLivenessSessionResultsCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { randomBytes, randomUUID } from 'crypto';
import prisma from '../config/database';
import { decryptTemplate } from '../domains/biometrics/biometric.encryption';
import { ApiError } from '../utils/error.util';
import { BiometricService } from './biometric.service';

const AWS_PROVIDER = 'AWS_REKOGNITION';
const FACE_SESSION_TTL_MS = 3 * 60 * 1000;
const TEMPORARY_CREDENTIAL_TTL_SECONDS = 900;

type FacePurpose = 'ENROLLMENT' | 'ATTENDANCE';
type PersonType = 'LEARNER' | 'STAFF';

interface CreateFaceSessionInput {
  purpose: FacePurpose;
  schoolId: string;
  deviceId?: string;
  personType?: PersonType;
  personId?: string;
  direction?: 'IN' | 'OUT';
  createdById?: string;
}

interface ProviderReference {
  provider: typeof AWS_PROVIDER;
  collectionId: string;
  faceId: string;
  externalImageId: string;
}

function boundedNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function requiredBearerToken(header?: string): string {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new ApiError(401, 'Terminal bearer token is required');
  return token;
}

function awsErrorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}

export class BiometricFaceService {
  private readonly biometricService = new BiometricService();
  private readonly knownCollections = new Set<string>();

  getConfiguration() {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';
    const roleArn = process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN || '';
    const missing = [
      !region && 'AWS_REGION',
      !roleArn && 'AWS_REKOGNITION_LIVENESS_ROLE_ARN',
    ].filter(Boolean) as string[];

    return {
      configured: missing.length === 0,
      provider: AWS_PROVIDER,
      region: region || null,
      livenessThreshold: boundedNumber('AWS_REKOGNITION_LIVENESS_THRESHOLD', 90, 0, 100),
      matchThreshold: boundedNumber('AWS_REKOGNITION_MATCH_THRESHOLD', 97, 0, 100),
      missing,
    };
  }

  requireConfiguration() {
    const configuration = this.getConfiguration();
    if (!configuration.configured || !configuration.region) {
      throw new ApiError(503, `AWS face recognition is not configured. Missing: ${configuration.missing.join(', ')}`);
    }
    return configuration as typeof configuration & { region: string };
  }

  private rekognitionClient() {
    const { region } = this.requireConfiguration();
    return new RekognitionClient({ region });
  }

  private stsClient() {
    const { region } = this.requireConfiguration();
    return new STSClient({ region });
  }

  private collectionId(schoolId: string) {
    const prefix = (process.env.AWS_REKOGNITION_COLLECTION_PREFIX || 'trendscore')
      .replace(/[^A-Za-z0-9_.-]/g, '-')
      .slice(0, 80);
    const tenant = schoolId.replace(/[^A-Za-z0-9_.-]/g, '-');
    return `${prefix}-${tenant}`.slice(0, 255);
  }

  private async ensureCollection(schoolId: string) {
    const collectionId = this.collectionId(schoolId);
    if (this.knownCollections.has(collectionId)) return collectionId;

    const client = this.rekognitionClient();
    try {
      await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    } catch (error: unknown) {
      if (awsErrorName(error) !== 'ResourceNotFoundException') throw error;
      try {
        await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
      } catch (createError: unknown) {
        if (awsErrorName(createError) !== 'ResourceAlreadyExistsException') throw createError;
      }
    }
    this.knownCollections.add(collectionId);
    return collectionId;
  }

  private async temporaryLivenessCredentials() {
    const configuration = this.requireConfiguration();
    const response = await this.stsClient().send(new AssumeRoleCommand({
      RoleArn: process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN,
      RoleSessionName: `trendscore-face-${randomBytes(6).toString('hex')}`,
      DurationSeconds: TEMPORARY_CREDENTIAL_TTL_SECONDS,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: ['rekognition:StartFaceLivenessSession'],
          Resource: '*',
        }],
      }),
    }));
    const credentials = response.Credentials;
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      throw new ApiError(503, 'AWS did not issue temporary liveness credentials');
    }
    return {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration?.toISOString(),
      region: configuration.region,
    };
  }

  async createSession(input: CreateFaceSessionInput) {
    this.requireConfiguration();
    if (input.purpose === 'ATTENDANCE' && (!input.deviceId || !input.direction)) {
      throw new ApiError(400, 'Terminal and attendance direction are required');
    }
    if (input.purpose === 'ENROLLMENT' && (!input.personId || !input.personType || !input.createdById)) {
      throw new ApiError(400, 'Person and enrolling administrator are required');
    }

    await this.ensureCollection(input.schoolId);
    const credentials = await this.temporaryLivenessCredentials();
    const response = await this.rekognitionClient().send(new CreateFaceLivenessSessionCommand({
      ClientRequestToken: randomUUID(),
      Settings: { AuditImagesLimit: 0 },
    }));
    if (!response.SessionId) throw new ApiError(503, 'AWS did not create a face liveness session');

    const expiresAt = new Date(Date.now() + FACE_SESSION_TTL_MS);
    await prisma.biometricFaceSession.create({
      data: {
        awsSessionId: response.SessionId,
        purpose: input.purpose,
        schoolId: input.schoolId,
        deviceId: input.deviceId,
        personType: input.personType,
        personId: input.personId,
        direction: input.direction,
        createdById: input.createdById,
        expiresAt,
      },
    });

    return {
      sessionId: response.SessionId,
      region: credentials.region,
      expiresAt,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        expiration: credentials.expiration,
      },
    };
  }

  private async openSession(awsSessionId: string, purpose: FacePurpose) {
    const session = await prisma.biometricFaceSession.findUnique({ where: { awsSessionId } });
    if (!session || session.purpose !== purpose) throw new ApiError(404, 'Face liveness session not found');
    if (session.status !== 'CREATED') throw new ApiError(409, 'Face liveness session has already been completed');
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.biometricFaceSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED', completedAt: new Date() },
      });
      throw new ApiError(410, 'Face liveness session expired. Start a new scan.');
    }
    return session;
  }

  private async livenessReference(awsSessionId: string, localSessionId: string) {
    const configuration = this.requireConfiguration();
    const result = await this.rekognitionClient().send(new GetFaceLivenessSessionResultsCommand({
      SessionId: awsSessionId,
    }));
    const confidence = Number(result.Confidence || 0);
    if (result.Status !== 'SUCCEEDED' || !result.ReferenceImage?.Bytes) {
      await prisma.biometricFaceSession.update({
        where: { id: localSessionId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      throw new ApiError(422, 'Face liveness analysis did not complete. Use manual entry or try again.');
    }
    if (confidence < configuration.livenessThreshold) {
      await prisma.biometricFaceSession.update({
        where: { id: localSessionId },
        data: { status: 'REJECTED', completedAt: new Date() },
      });
      throw new ApiError(422, 'Liveness could not be confirmed. Use manual entry or try again.');
    }
    return { image: result.ReferenceImage.Bytes, confidence };
  }

  private async resolvePerson(personType: PersonType, personId: string) {
    if (personType === 'LEARNER') {
      const learner = await prisma.learner.findFirst({
        where: { id: personId, archived: false },
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      });
      if (!learner) throw new ApiError(404, 'Learner not found');
      return { id: learner.id, reference: learner.admissionNumber, name: `${learner.firstName} ${learner.lastName}`.trim() };
    }

    const staff = await prisma.user.findFirst({
      where: { id: personId, archived: false },
      select: { id: true, staffId: true, firstName: true, lastName: true },
    });
    if (!staff?.staffId) throw new ApiError(422, 'Staff member requires a staff ID before face enrollment');
    return { id: staff.id, reference: staff.staffId, name: `${staff.firstName} ${staff.lastName}`.trim() };
  }

  async completeEnrollment(awsSessionId: string, schoolId: string, createdById: string) {
    const session = await this.openSession(awsSessionId, 'ENROLLMENT');
    if (session.schoolId !== schoolId || session.createdById !== createdById || !session.personId || !session.personType) {
      throw new ApiError(403, 'Face enrollment session does not belong to this administrator');
    }
    const personType = session.personType as PersonType;
    await this.resolvePerson(personType, session.personId);

    const existing = await prisma.biometricCredential.findFirst({
      where: {
        schoolId,
        status: 'ACTIVE',
        type: 'FACE',
        ...(personType === 'LEARNER' ? { learnerId: session.personId } : { userId: session.personId }),
      },
      select: { id: true },
    });
    if (existing) throw new ApiError(409, 'An active face credential already exists. Revoke it before re-enrolling.');

    const { image, confidence: livenessConfidence } = await this.livenessReference(awsSessionId, session.id);
    const collectionId = await this.ensureCollection(schoolId);
    const externalImageId = `${personType}:${session.personId}`;
    const indexed = await this.rekognitionClient().send(new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: image },
      ExternalImageId: externalImageId,
      MaxFaces: 1,
      QualityFilter: 'HIGH',
      DetectionAttributes: ['DEFAULT'],
    }));
    const face = indexed.FaceRecords?.[0]?.Face;
    if (!face?.FaceId) {
      await prisma.biometricFaceSession.update({
        where: { id: session.id },
        data: { status: 'REJECTED', completedAt: new Date() },
      });
      throw new ApiError(422, 'The face image did not meet enrollment quality requirements. Try again in better lighting.');
    }

    const providerReference: ProviderReference = {
      provider: AWS_PROVIDER,
      collectionId,
      faceId: face.FaceId,
      externalImageId,
    };
    try {
      const credential = await this.biometricService.enrollCredential({
        schoolId,
        ...(personType === 'LEARNER' ? { learnerId: session.personId } : { userId: session.personId }),
        type: 'FACE',
        template: Buffer.from(JSON.stringify(providerReference), 'utf8'),
        quality: Math.round(Number(face.Confidence || 0)),
        provider: AWS_PROVIDER,
        consentRecordedAt: session.createdAt,
        consentRecordedById: createdById,
      });
      await prisma.biometricFaceSession.update({
        where: { id: session.id },
        data: { status: 'SUCCEEDED', completedAt: new Date() },
      });
      return { credential, livenessConfidence: livenessConfidence / 100 };
    } catch (error) {
      await this.rekognitionClient().send(new DeleteFacesCommand({
        CollectionId: collectionId,
        FaceIds: [face.FaceId],
      })).catch(() => undefined);
      throw error;
    }
  }

  private providerReference(credential: { template: Buffer; keyVersion: number }): ProviderReference | null {
    try {
      const decrypted = decryptTemplate(credential.template.toString('utf8'), credential.keyVersion);
      const parsed = JSON.parse(decrypted.toString('utf8')) as ProviderReference;
      return parsed.provider === AWS_PROVIDER && parsed.faceId ? parsed : null;
    } catch {
      return null;
    }
  }

  async completeAttendance(awsSessionId: string, deviceId: string, deviceToken: string) {
    const session = await this.openSession(awsSessionId, 'ATTENDANCE');
    const device = await this.biometricService.authenticateTerminal(deviceId, deviceToken);
    if (session.deviceId !== device.id || session.schoolId !== device.schoolId || !session.direction) {
      throw new ApiError(403, 'Face attendance session does not belong to this terminal');
    }

    const { image, confidence: livenessConfidence } = await this.livenessReference(awsSessionId, session.id);
    const configuration = this.requireConfiguration();
    const collectionId = await this.ensureCollection(session.schoolId);
    const searched = await this.rekognitionClient().send(new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { Bytes: image },
      FaceMatchThreshold: configuration.matchThreshold,
      MaxFaces: 1,
      QualityFilter: 'HIGH',
    }));
    const match = searched.FaceMatches?.[0];
    const externalImageId = match?.Face?.ExternalImageId;
    const faceId = match?.Face?.FaceId;
    const similarity = Number(match?.Similarity || 0);
    const identity = externalImageId?.match(/^(LEARNER|STAFF):(.+)$/);
    if (!identity || !faceId || similarity < configuration.matchThreshold) {
      await prisma.biometricFaceSession.update({
        where: { id: session.id },
        data: { status: 'REJECTED', completedAt: new Date() },
      });
      throw new ApiError(404, 'Face not recognized. Use manual entry or ask an administrator to enroll this person.');
    }

    const personType = identity[1] as PersonType;
    const personId = identity[2];
    const activeCredentials = await prisma.biometricCredential.findMany({
      where: {
        schoolId: session.schoolId,
        status: 'ACTIVE',
        type: 'FACE',
        provider: AWS_PROVIDER,
        ...(personType === 'LEARNER' ? { learnerId: personId } : { userId: personId }),
      },
      select: { template: true, keyVersion: true },
    });
    const activeMatch = activeCredentials.some((credential) => this.providerReference(credential)?.faceId === faceId);
    if (!activeMatch) {
      await prisma.biometricFaceSession.update({
        where: { id: session.id },
        data: { status: 'REJECTED', completedAt: new Date() },
      });
      throw new ApiError(404, 'Face credential is no longer active. Use manual entry or re-enroll the person.');
    }

    const person = await this.resolvePerson(personType, personId);
    const attendance = await this.biometricService.processAttendanceLog({
      deviceId,
      deviceToken,
      eventId: `face:${awsSessionId}`,
      personId: person.reference,
      personType,
      timestamp: new Date(),
      direction: session.direction as 'IN' | 'OUT',
      modality: 'FACE',
      matchConfidence: similarity / 100,
      livenessStatus: 'PASSED',
      livenessConfidence: livenessConfidence / 100,
      providerVerified: true,
    });
    await prisma.biometricFaceSession.update({
      where: { id: session.id },
      data: { status: 'SUCCEEDED', completedAt: new Date() },
    });
    return attendance;
  }

  async createTerminalSession(deviceId: string, authorization: string | undefined, direction: 'IN' | 'OUT') {
    const deviceToken = requiredBearerToken(authorization);
    const device = await this.biometricService.authenticateTerminal(deviceId, deviceToken);
    if (!device.schoolId) throw new ApiError(422, 'Terminal is not assigned to a school');
    return this.createSession({
      purpose: 'ATTENDANCE',
      schoolId: device.schoolId,
      deviceId: device.id,
      direction,
    });
  }

  async revokeCredential(credentialId: string, schoolId: string) {
    const credential = await prisma.biometricCredential.findFirst({
      where: { id: credentialId, schoolId },
      select: { id: true, type: true, provider: true, template: true, keyVersion: true },
    });
    if (!credential) throw new ApiError(404, 'Credential not found');

    if (credential.type === 'FACE' && credential.provider === AWS_PROVIDER) {
      const reference = this.providerReference(credential);
      if (reference) {
        await this.rekognitionClient().send(new DeleteFacesCommand({
          CollectionId: reference.collectionId,
          FaceIds: [reference.faceId],
        }));
      }
    }
    return prisma.biometricCredential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED' },
      select: { id: true, type: true, status: true, updatedAt: true },
    });
  }
}

export const biometricFaceService = new BiometricFaceService();
export { requiredBearerToken };
