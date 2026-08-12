#!/usr/bin/env bash
# Verify an already-running school's AWS Rekognition configuration from inside
# its backend container. No credential or AWS session value is printed.
set -euo pipefail

SCHOOL_ID="${1:-}"
MANIFEST_PATH="${2:-/srv/zawadi/apps/deploy/instances.manifest.json}"

log() { printf '[aws-verify] %s\n' "$*" >&2; }
fail() { printf '[aws-verify] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${SCHOOL_ID}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "school id is missing or invalid"
[[ -f "${MANIFEST_PATH}" && ! -L "${MANIFEST_PATH}" ]] || fail "deployment manifest is missing or unsafe"
command -v jq >/dev/null 2>&1 || fail "jq is required"
command -v docker >/dev/null 2>&1 || fail "docker is required"

TARGET_ROW="$(jq -cer --arg id "${SCHOOL_ID}" '.instances[] | select(.id == $id)' "${MANIFEST_PATH}")" \
  || fail "school is not present in the deployment manifest"
TARGET_KIND="$(jq -r '.kind // empty' <<< "${TARGET_ROW}")"

if [[ "${TARGET_KIND}" == "main" ]]; then
  BACKEND_CONTAINER="zawadi-backend"
else
  COMPOSE_PROJECT="$(jq -r '.compose_project // empty' <<< "${TARGET_ROW}")"
  [[ "${COMPOSE_PROJECT}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || fail "manifest compose project is invalid"
  BACKEND_CONTAINER="$(sudo docker ps \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=backend" \
    --format '{{.Names}}' | head -n1)"
fi

[[ -n "${BACKEND_CONTAINER}" ]] || fail "running backend container was not found"
sudo docker inspect "${BACKEND_CONTAINER}" >/dev/null 2>&1 || fail "backend container is unavailable"

log "Running protected AWS verification inside ${BACKEND_CONTAINER}"
sudo docker exec -i "${BACKEND_CONTAINER}" node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const {
  CreateCollectionCommand,
  CreateFaceLivenessSessionCommand,
  DescribeCollectionCommand,
  RekognitionClient,
} = require('@aws-sdk/client-rekognition');
const {
  AssumeRoleCommand,
  GetCallerIdentityCommand,
  STSClient,
} = require('@aws-sdk/client-sts');
const { randomBytes, randomUUID } = require('crypto');

const prisma = new PrismaClient();

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const error = new Error(`${name} is missing`);
    error.name = 'ConfigurationError';
    throw error;
  }
  return value;
}

async function verify() {
  const region = required('AWS_REGION');
  const roleArn = required('AWS_REKOGNITION_LIVENESS_ROLE_ARN');
  required('AWS_ACCESS_KEY_ID');
  required('AWS_SECRET_ACCESS_KEY');

  const school = await prisma.school.findFirst({
    where: { active: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (!school) {
    const error = new Error('active school was not found');
    error.name = 'SchoolConfigurationError';
    throw error;
  }

  const sts = new STSClient({ region });
  await sts.send(new GetCallerIdentityCommand({}));

  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `trendscore-verify-${randomBytes(6).toString('hex')}`,
    DurationSeconds: 900,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: ['rekognition:StartFaceLivenessSession'],
        Resource: '*',
      }],
    }),
  }));
  if (!assumed.Credentials?.AccessKeyId || !assumed.Credentials.SecretAccessKey || !assumed.Credentials.SessionToken) {
    const error = new Error('temporary role credentials were not issued');
    error.name = 'RoleCredentialError';
    throw error;
  }

  const prefix = String(process.env.AWS_REKOGNITION_COLLECTION_PREFIX || 'trendscore')
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .slice(0, 80);
  const collectionId = `${prefix}-${school.id.replace(/[^A-Za-z0-9_.-]/g, '-')}`.slice(0, 255);
  const rekognition = new RekognitionClient({ region });
  try {
    await rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
  } catch (error) {
    if (error?.name !== 'ResourceNotFoundException') throw error;
    try {
      await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    } catch (createError) {
      if (createError?.name !== 'ResourceAlreadyExistsException') throw createError;
    }
  }

  await rekognition.send(new CreateFaceLivenessSessionCommand({
    ClientRequestToken: randomUUID(),
    Settings: { AuditImagesLimit: 0 },
  }));

  process.stdout.write(JSON.stringify({
    ok: true,
    region,
    credentialsVerified: true,
    livenessRoleVerified: true,
    collectionReady: true,
    livenessSessionCreated: true,
  }) + '\n');
}

verify()
  .catch((error) => {
    process.stderr.write(JSON.stringify({
      ok: false,
      error: String(error?.name || 'AWSVerificationFailed'),
      statusCode: error?.$metadata?.httpStatusCode || null,
    }) + '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

log "AWS biometric verification passed for ${SCHOOL_ID}"
