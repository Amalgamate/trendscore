import React from 'react';
import { ArrowUpRight, ClipboardList } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

export default function RegisterForm({ onSwitchToLogin }) {
  const applicationUrl = import.meta.env.VITE_SCHOOL_APPLICATION_URL || 'https://admin.trendscore.co.ke/apply';

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardList aria-hidden="true" size={24} />
        </div>
        <CardTitle>Apply for {PRODUCT_DISPLAY_NAME}</CardTitle>
        <CardDescription>
          Submit school details and a package request for our team to review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
          Submitting an application does not create a school account or start an installation.
          After internal review and installation, the school administrator will receive a one-time
          activation link by email.
        </div>
        <Button asChild className="w-full">
          <a href={applicationUrl}>
            Start school application
            <ArrowUpRight aria-hidden="true" className="ml-2" size={16} />
          </a>
        </Button>
        <button
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={onSwitchToLogin}
          type="button"
        >
          Already have an account? Sign in
        </button>
      </CardContent>
    </Card>
  );
}
