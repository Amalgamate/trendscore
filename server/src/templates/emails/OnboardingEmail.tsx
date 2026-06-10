import * as React from 'react';
import { Button, Text, Section, Heading, Hr, Row, Column } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

interface OnboardingEmailProps {
    schoolName: string;
    adminName: string;
    loginUrl: string;
    email?: string; // Add email prop for credentials display
    customHeading?: string;
    customBody?: string;
}

export const OnboardingEmail = ({
    schoolName,
    adminName,
    loginUrl,
    email,
    customHeading,
    customBody,
}: OnboardingEmailProps) => {
    return (
        <EmailLayout
            previewText={`Welcome to ${PRODUCT_DISPLAY_NAME} - Setup ${schoolName}`}
            schoolName={schoolName}
            heading={customHeading || "Welcome to your new school Operating System"}
        >
            <Text style={text}>
                Hello <strong>{adminName}</strong>,
            </Text>

            {customBody ? (
                <Text style={text} dangerouslySetInnerHTML={{ __html: customBody.replace(/\n/g, '<br/>') }} />
            ) : (
                <>
                    <Text style={text}>
                        Thank you for choosing <strong>{PRODUCT_DISPLAY_NAME}</strong>. We have set up a secure environment for <strong>{schoolName}</strong>.
                        <br />
                        You are now ready to modernize your school operations with the most advanced CBC-native assessment and finance platform.
                    </Text>

                    {/* Credentials Section */}
                    <Section style={credentialsContainer}>
                        <Heading as="h3" style={credentialsTitle}>Your Login Details</Heading>
                        <Row>
                            <Column>
                                <Text style={credentialLabel}>School Portal:</Text>
                                <Text style={credentialValue}>{loginUrl}</Text>
                            </Column>
                        </Row>
                        <Row>
                            <Column>
                                <Text style={credentialLabel}>Username:</Text>
                                <Text style={credentialValue}>{email}</Text>
                            </Column>
                        </Row>
                        <Row>
                            <Column>
                                <Text style={credentialLabel}>Password:</Text>
                                <Text style={credentialValue}>The password you set during registration</Text>
                            </Column>
                        </Row>
                    </Section>

                    <Text style={text}>
                        Follow your <strong>Quick Start Guide</strong> below to get running in minutes:
                    </Text>

                    <Section style={stepsContainer}>
                        <Step
                            number="1"
                            title="Configure Academics"
                            description="Go to 'Academic Settings' to define your Terms, Grading Systems, and Class Streams."
                        />
                        <Step
                            number="2"
                            title="Add Your People"
                            description="Navigate to 'User Management' to invite Teachers. You can bulk import students via Excel later."
                        />
                        <Step
                            number="3"
                            title="Set Up Curriculum"
                            description="Assign subjects (Learning Areas) to classes so teachers can start entering marks."
                        />
                    </Section>
                </>
            )}

            <Section style={btnContainer}>
                <Button style={button} href={loginUrl}>
                    Login to Dashboard
                </Button>
            </Section>

            <Hr style={hr} />

            <Text style={subText}>
                <strong>Need help?</strong> Our support team is ready to assist you with data migration or system configuration.
                Just reply to this email.
            </Text>
        </EmailLayout>
    );
};

const Step = ({ number, title, description }: { number: string, title: string, description: string }) => (
    <Row style={stepRow}>
        <Column style={numberCol}>
            <Section style={circle}>
                <Text style={numberText}>{number}</Text>
            </Section>
        </Column>
        <Column>
            <Heading as="h3" style={stepTitle}>{title}</Heading>
            <Text style={stepDescription}>{description}</Text>
        </Column>
    </Row>
);

const text = {
    color: '#374151',
    fontSize: '15px',
    lineHeight: '24px',
    marginBottom: '20px',
};

const credentialsContainer = {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '32px',
};

const credentialsTitle = {
    color: '#520050', // Purple
    fontSize: '16px',
    fontWeight: '700',
    marginTop: '0',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
};

const credentialLabel = {
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '4px',
    marginTop: '0',
    textTransform: 'uppercase' as const,
};

const credentialValue = {
    color: '#111827',
    fontSize: '15px',
    fontWeight: '500', // normal weight
    fontFamily: 'Consolas, monospace', // monospaced likely better for credentials
    marginBottom: '16px',
    marginTop: '0',
};

const stepsContainer = {
    marginTop: '20px',
    marginBottom: '20px',
};

const stepRow = {
    marginBottom: '24px',
};

const numberCol = {
    width: '48px',
    paddingRight: '16px',
    verticalAlign: 'top' as const,
};

const circle = {
    width: '32px',
    height: '32px',
    backgroundColor: '#f0fdfa', // Light teal bg
    borderRadius: '50%',
    border: '1px solid #017E84', // Teal border
    textAlign: 'center' as const,
};

const numberText = {
    color: '#017E84', // Teal text
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '2px',
    marginBottom: '0',
};

const stepTitle = {
    color: '#1f2937',
    fontSize: '16px',
    fontWeight: '700',
    marginTop: '0',
    marginBottom: '4px',
};

const stepDescription = {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: '22px',
    marginTop: '0',
    marginBottom: '0',
};

const subText = {
    color: '#9ca3af',
    fontSize: '13px',
    lineHeight: '20px',
};

const btnContainer = {
    textAlign: 'center' as const,
    margin: '32px 0 10px',
};

const button = {
    backgroundColor: '#520050', // Purple
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    padding: '12px 32px',
    display: 'inline-block',
    boxShadow: '0 4px 6px -1px rgba(113, 75, 103, 0.2)',
};

const hr = {
    borderColor: '#f3f4f6',
    margin: '32px 0 24px',
};

export default OnboardingEmail;
