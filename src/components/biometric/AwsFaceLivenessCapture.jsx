import React, { useMemo } from 'react';
import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react-liveness/styles.css';

const AwsFaceLivenessCapture = ({ session, onAnalysisComplete, onError, onCancel }) => {
  const credentialProvider = useMemo(() => async () => ({
    accessKeyId: session.credentials.accessKeyId,
    secretAccessKey: session.credentials.secretAccessKey,
    sessionToken: session.credentials.sessionToken,
    ...(session.credentials.expiration
      ? { expiration: new Date(session.credentials.expiration) }
      : {}),
  }), [session]);

  return (
    <div className="aws-face-liveness overflow-hidden rounded-3xl bg-white text-slate-950">
      <FaceLivenessDetectorCore
        sessionId={session.sessionId}
        region={session.region}
        onAnalysisComplete={onAnalysisComplete}
        onError={onError}
        onUserCancel={onCancel}
        config={{ credentialProvider }}
      />
    </div>
  );
};

export default AwsFaceLivenessCapture;
