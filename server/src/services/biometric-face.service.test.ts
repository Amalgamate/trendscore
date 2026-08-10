import { BiometricFaceService, requiredBearerToken } from './biometric-face.service';

describe('BiometricFaceService configuration', () => {
  const originalRegion = process.env.AWS_REGION;
  const originalDefaultRegion = process.env.AWS_DEFAULT_REGION;
  const originalRoleArn = process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN;
  const originalLivenessThreshold = process.env.AWS_REKOGNITION_LIVENESS_THRESHOLD;
  const originalMatchThreshold = process.env.AWS_REKOGNITION_MATCH_THRESHOLD;

  afterEach(() => {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
    if (originalDefaultRegion === undefined) delete process.env.AWS_DEFAULT_REGION;
    else process.env.AWS_DEFAULT_REGION = originalDefaultRegion;
    if (originalRoleArn === undefined) delete process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN;
    else process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN = originalRoleArn;
    if (originalLivenessThreshold === undefined) delete process.env.AWS_REKOGNITION_LIVENESS_THRESHOLD;
    else process.env.AWS_REKOGNITION_LIVENESS_THRESHOLD = originalLivenessThreshold;
    if (originalMatchThreshold === undefined) delete process.env.AWS_REKOGNITION_MATCH_THRESHOLD;
    else process.env.AWS_REKOGNITION_MATCH_THRESHOLD = originalMatchThreshold;
  });

  it('fails closed and reports the missing AWS settings', () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN;

    const configuration = new BiometricFaceService().getConfiguration();

    expect(configuration.configured).toBe(false);
    expect(configuration.missing).toEqual([
      'AWS_REGION',
      'AWS_REKOGNITION_LIVENESS_ROLE_ARN',
    ]);
  });

  it('exposes only safe provider readiness and bounded thresholds', () => {
    process.env.AWS_REGION = 'af-south-1';
    process.env.AWS_REKOGNITION_LIVENESS_ROLE_ARN = 'arn:aws:iam::123456789012:role/TrendScoreFaceLivenessClient';
    process.env.AWS_REKOGNITION_LIVENESS_THRESHOLD = '91';
    process.env.AWS_REKOGNITION_MATCH_THRESHOLD = '98';

    expect(new BiometricFaceService().getConfiguration()).toEqual({
      configured: true,
      provider: 'AWS_REKOGNITION',
      region: 'af-south-1',
      livenessThreshold: 91,
      matchThreshold: 98,
      missing: [],
    });
  });

  it('requires a bearer token for terminal face endpoints', () => {
    expect(requiredBearerToken('Bearer terminal-secret')).toBe('terminal-secret');
    expect(() => requiredBearerToken(undefined)).toThrow('Terminal bearer token is required');
  });
});
