import * as React from 'react';
import { Button, Text, Section, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

interface WelcomeEmailProps {
    schoolName: string;
    adminName: string;
    loginUrl: string;
    tempPassword?: string;
    customHeading?: string;
    customBody?: string;
}

export const WelcomeEmail = ({
    schoolName,
    adminName,
    loginUrl,
    tempPassword,
    customHeading,
    customBody,
}: WelcomeEmailProps) => {
    return (
        <EmailLayout
            previewText={`Welcome to ${PRODUCT_DISPLAY_NAME}, ${schoolName}!`}
            schoolName={schoolName}
            heading={customHeading || "Welcome to your new School Management System"}
        >
            <Text style={text}>Dear <strong>{adminName}</strong>,</Text>

            {customBody ? (
                <Text style={text} dangerouslySetInnerHTML={{ __html: customBody.replace(/\n/g, '<br/>') }} />
            ) : (
                <Text style={text}>
                    Congratulations! Your school, <strong>{schoolName}</strong>, has been successfully registered on {PRODUCT_DISPLAY_NAME}.
                    We are thrilled to have you on board.
                </Text>
            )}

            <Text style={text}>
                {PRODUCT_DISPLAY_NAME} is designed to simplify your administrative tasks, from CBC assessment tracking to generating complex report cards instantly.
            </Text>

            <Section style={btnContainer}>
                <Button style={button} href={loginUrl}>
                    Log In to Dashboard
                </Button>
            </Section>

            {tempPassword && (
                <Section style={credentialsBox}>
                    <Text style={credentialsTitle}>Your temporary credentials:</Text>
                    <Text style={credentialItem}><strong>Username:</strong> {adminName}</Text>
                    <Text style={credentialItem}><strong>Password:</strong> <code style={code}>{tempPassword}</code></Text>
                    <Text style={credentialsNote}>Please change your password after your first login.</Text>
                </Section>
            )}

            <Text style={text}>
                Or copy and paste this link into your browser:
                <br />
                <a href={loginUrl} style={link}>{loginUrl}</a>
            </Text>

            <Hr style={hr} />

            <Text style={subText}>
                <strong>Next Steps:</strong> Once you log in, we recommend completing your school profile and setting up your first academic term.
            </Text>
        </EmailLayout>
    );
};

const text = {
    color: '#334155',
    fontSize: '16px',
    lineHeight: '26px',
    marginBottom: '20px',
};

const subText = {
    color: '#64748b',
    fontSize: '14px',
    lineHeight: '22px',
};

const btnContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
};

const button = {
    backgroundColor: '#1e3a8a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '12px 24px',
    display: 'inline-block',
    boxShadow: '0 4px 6px -1px rgba(30, 58, 138, 0.2)',
};

const link = {
    color: '#1e3a8a',
    fontSize: '14px',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
};

const hr = {
    borderColor: '#e2e8f0',
    margin: '32px 0 24px',
};

const credentialsBox = {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
};

const credentialsTitle = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
};

const credentialItem = {
    fontSize: '15px',
    color: '#1e293b',
    margin: '4px 0',
};

const credentialsNote = {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '12px',
    fontStyle: 'italic',
};

const code = {
    fontFamily: 'monospace',
    backgroundColor: '#f1f5f9',
    padding: '2px 4px',
    borderRadius: '4px',
    color: '#0f172a',
};

export default WelcomeEmail;
