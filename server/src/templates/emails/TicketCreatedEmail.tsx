
import * as React from 'react';
import {
    Html,
    Head,
    Preview,
    Body,
    Container,
    Section,
    Text,
    Heading,
    Link,
    Hr,
} from '@react-email/components';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

interface TicketCreatedEmailProps {
    schoolName: string;
    userName: string;
    ticketSubject: string;
    ticketPriority: string;
    ticketMessage: string;
    ticketLink: string;
}

export const TicketCreatedEmail = ({
    schoolName,
    userName,
    ticketSubject,
    ticketPriority,
    ticketMessage,
    ticketLink,
}: TicketCreatedEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>New Support Ticket: {ticketSubject}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>New Support Ticket Created</Heading>

                    <Section>
                        <Text style={paragraph}>
                            A new support ticket has been created by <strong>{userName}</strong> from <strong>{schoolName}</strong>.
                        </Text>

                        <div style={ticketInfo}>
                            <Text style={infoText}><strong>Subject:</strong> {ticketSubject}</Text>
                            <Text style={infoText}>
                                <strong>Priority:</strong>
                                <span style={{
                                    ...badge,
                                    backgroundColor: ticketPriority === 'CRITICAL' || ticketPriority === 'HIGH' ? '#fee2e2' : '#e0f2fe',
                                    color: ticketPriority === 'CRITICAL' || ticketPriority === 'HIGH' ? '#991b1b' : '#075985'
                                }}>
                                    {ticketPriority}
                                </span>
                            </Text>
                        </div>

                        <Text style={subHeading}>Message:</Text>
                        <Section style={messageBox}>
                            <Text style={messageText}>{ticketMessage}</Text>
                        </Section>

                        <Section style={btnContainer}>
                            <Link style={button} href={ticketLink}>
                                View & Reply to Ticket
                            </Link>
                        </Section>
                    </Section>

                    <Hr style={hr} />

                    <Text style={footer}>
                        This is an automated notification from the {PRODUCT_DISPLAY_NAME} Support System.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
};

export default TicketCreatedEmail;

// Styles
const main = {
    backgroundColor: '#f6f9fc',
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
};

const heading = {
    fontSize: '24px',
    fontWeight: '600',
    color: '#484848',
    padding: '0 48px',
};

const subHeading = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#484848',
    padding: '0 48px',
    marginTop: '24px',
};

const paragraph = {
    fontSize: '16px',
    lineHeight: '26px',
    color: '#484848',
    padding: '0 48px',
};

const ticketInfo = {
    padding: '16px 48px',
    backgroundColor: '#f9fafb',
    margin: '12px 48px',
    borderRadius: '8px',
};

const infoText = {
    margin: '4px 0',
    fontSize: '15px',
    color: '#374151',
};

const messageBox = {
    margin: '8px 48px',
    padding: '16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
};

const messageText = {
    margin: '0',
    color: '#4b5563',
    fontStyle: 'italic',
};

const badge = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '8px',
};

const btnContainer = {
    padding: '24px 48px',
};

const button = {
    backgroundColor: '#2563eb',
    borderRadius: '5px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'block',
    width: '100%',
    padding: '12px 0',
};

const hr = {
    borderColor: '#e6ebf1',
    margin: '20px 0',
};

const footer = {
    color: '#8898aa',
    fontSize: '12px',
    lineHeight: '16px',
    padding: '0 48px',
};
