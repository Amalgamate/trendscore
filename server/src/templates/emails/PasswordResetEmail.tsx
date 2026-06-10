import * as React from 'react';
import { Button, Text, Section, Heading, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

interface PasswordResetEmailProps {
    schoolName: string;
    userName: string;
    resetLink: string;
}

export const PasswordResetEmail = ({
    schoolName,
    userName,
    resetLink,
}: PasswordResetEmailProps) => {
    return (
        <EmailLayout
            previewText={`Reset your ${PRODUCT_DISPLAY_NAME} password`}
            schoolName={schoolName}
            heading="Password Reset Request"
        >
            <Text style={text}>
                Hi <strong>{userName}</strong>,
            </Text>

            <Text style={text}>
                We received a request to reset your password for your {PRODUCT_DISPLAY_NAME} account at <strong>{schoolName}</strong>.
                If you didn't request this, you can safely ignore this email.
            </Text>

            <Section style={btnContainer}>
                <Button style={button} href={resetLink}>
                    Reset Password
                </Button>
            </Section>

            <Text style={text}>
                This link will expire in 1 hour for your security.
            </Text>

            <Hr style={hr} />

            <Text style={subText}>
                If the button above doesn't work, copy and paste this link into your browser:
                <br />
                <a href={resetLink} style={link}>{resetLink}</a>
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

export default PasswordResetEmail;
