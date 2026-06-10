import * as React from 'react';
import {
    Html,
    Body,
    Head,
    Heading,
    Container,
    Preview,
    Section,
    Text,
    Img,
    Link,
    Hr,
    Row,
    Column,
} from '@react-email/components';
import { PRODUCT_APP_URL, PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

interface EmailLayoutProps {
    previewText: string;
    heading?: string;
    schoolName?: string;
    logoUrl?: string; // Optional custom logo
    schoolId?: string;
    children: React.ReactNode;
}

const baseUrl = process.env.FRONTEND_URL || PRODUCT_APP_URL;
const brandColor = '#520050';
const tealColor = '#017E84';

// For testing purposes, we use a public icon that won't break in Gmail
const publicLogoUrl = 'https://img.icons8.com/fluency-systems-filled/96/714B67/graduation-cap.png';

export const EmailLayout = ({
    previewText,
    heading,
    schoolName = `${PRODUCT_DISPLAY_NAME} Platform`,
    children,
}: EmailLayoutProps) => {
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Row style={logoRow}>
                            <Column style={logoColumn}>
                                <Img
                                    src={publicLogoUrl}
                                    width="42"
                                    height="42"
                                    alt="E"
                                    style={logo}
                                />
                            </Column>
                            <Column>
                                <Text style={brandName}>{PRODUCT_DISPLAY_NAME}</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* Main Content Card */}
                    <Section style={contentContainer}>
                        <Text style={schoolNameHeader}>{schoolName}</Text>
                        {heading && <Heading style={h1}>{heading}</Heading>}
                        <Hr style={divider} />
                        {children}
                    </Section>

                    {/* Footer */}
                    <Section style={footer}>
                        <Text style={footerText}>
                            &copy; {new Date().getFullYear()} {PRODUCT_DISPLAY_NAME}. All rights reserved.
                        </Text>
                        <Text style={footerText}>
                            <Link href={`${baseUrl}/support`} style={link}>Help Center</Link> •{' '}
                            <Link href={`${baseUrl}/privacy`} style={link}>Privacy Policy</Link>
                        </Text>
                        <Text style={footerSubText}>
                            The Operating System for Modern Schools
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

// Styles
const main = {
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '40px auto',
    padding: '0',
    borderRadius: '12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    maxWidth: '580px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
};

const header = {
    padding: '30px 48px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f3f4f6',
};

const logoRow = {
    display: 'inline-block',
    textAlign: 'center' as const,
    margin: '0 auto',
};

const logoColumn = {
    verticalAlign: 'middle',
    paddingRight: '12px',
};

const logo = {
    borderRadius: '8px',
};

const brandName = {
    color: '#520050',
    fontSize: '26px',
    fontWeight: '800' as const,
    margin: '0',
    letterSpacing: '-1px',
    verticalAlign: 'middle',
};

const contentContainer = {
    padding: '40px 48px',
};

const schoolNameHeader = {
    color: '#017E84',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    margin: '0 0 10px',
};

const h1 = {
    color: '#111827',
    fontSize: '32px',
    fontWeight: '800',
    lineHeight: '40px',
    margin: '0 0 20px',
    textAlign: 'left' as const,
};

const divider = {
    borderColor: '#f3f4f6',
    margin: '0 0 30px',
};

const footer = {
    padding: '40px',
    backgroundColor: '#f9fafb',
    textAlign: 'center' as const,
    borderTop: '1px solid #f3f4f6',
};

const footerText = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0',
};

const footerSubText = {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '16px 0 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
};

const link = {
    color: brandColor,
    textDecoration: 'none',
    fontWeight: '600',
};
