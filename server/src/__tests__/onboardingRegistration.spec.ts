import { Request, Response } from 'express';
import { OnboardingController } from '../controllers/onboarding.controller';

describe('direct school registration shutdown', () => {
  it('requires applicants to use the review-first school application flow', async () => {
    const req = {} as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await new OnboardingController().registerFull(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Direct school registration is closed. Submit a school application for internal review before installation.',
    });
  });
});
