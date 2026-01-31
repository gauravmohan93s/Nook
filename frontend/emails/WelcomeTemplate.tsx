import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Button,
  Section,
  Hr,
  Link,
} from '@react-email/components';

interface WelcomeEmailProps {
  userFirstname?: string;
}

export const WelcomeEmail = ({
  userFirstname = 'Reader',
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to your new reading sanctuary.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Nook.</Heading>
        <Text style={text}>
          Hello {userFirstname},
        </Text>
        <Text style={text}>
          You've just joined a community of readers who value clarity over noise. 
          Nook is designed to be your calm filter in a chaotic digital world.
        </Text>
        
        <Section style={featureSection}>
          <Text style={textBold}>Here is what you can do now:</Text>
          <ul style={list}>
            <li style={listItem}>🔓 <strong>Unlock</strong> articles from Medium, arXiv, and more.</li>
            <li style={listItem}>🧠 <strong>Synthesize</strong> insights with our AI Summaries.</li>
            <li style={listItem}>🎧 <strong>Listen</strong> to any article on the go.</li>
          </ul>
        </Section>

        <Section style={btnContainer}>
          <Button style={button} href="https://nook-xi.vercel.app/dashboard">
            Go to Your Dashboard
          </Button>
        </Section>

        <Text style={text}>
          We are constantly evolving. Expect new features, smarter AI, and deeper insights in the coming weeks.
        </Text>
        
        <Hr style={hr} />
        
        <Text style={footer}>
          Nook Inc. • Democratizing Knowledge
          <br />
          <Link href="https://nook-xi.vercel.app" style={link}>
            Visit Website
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const h1 = {
  fontSize: '24px',
  fontWeight: 'bold',
  letterSpacing: '-0.5px',
  color: '#1a1a1a',
  paddingBottom: '16px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '26px',
  marginBottom: '16px',
};

const textBold = {
  ...text,
  fontWeight: 'bold',
};

const featureSection = {
  background: '#f9f9f9',
  padding: '24px',
  borderRadius: '8px',
  marginBottom: '24px',
};

const list = {
  paddingLeft: '20px',
  marginTop: '0',
};

const listItem = {
  marginBottom: '8px',
  color: '#4a4a4a',
};

const btnContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
};

const hr = {
  borderColor: '#eaeaea',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};

const link = {
  color: '#8898aa',
  textDecoration: 'underline',
};
