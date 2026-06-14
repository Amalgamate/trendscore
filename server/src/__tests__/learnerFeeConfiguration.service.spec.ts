import { applyFeeAdjustment } from '../services/learnerFeeConfiguration.service';

describe('learner fee configuration calculations', () => {
  it('creates a full exemption without sponsor liability', () => {
    expect(applyFeeAdjustment(12000, { feeTypeId: 'tuition', mode: 'EXEMPT' })).toEqual({
      studentAmount: 0,
      sponsorAmount: 0,
      adjustmentAmount: 12000,
    });
  });

  it('splits a sponsored fee between sponsor and student', () => {
    expect(applyFeeAdjustment(10000, {
      feeTypeId: 'tuition',
      mode: 'SPONSOR_PERCENT',
      value: 60,
    })).toEqual({
      studentAmount: 4000,
      sponsorAmount: 6000,
      adjustmentAmount: 0,
    });
  });

  it('supports a fixed student payable amount', () => {
    expect(applyFeeAdjustment(11500, {
      feeTypeId: 'tuition',
      mode: 'FIXED_STUDENT_AMOUNT',
      value: 4500,
    })).toEqual({
      studentAmount: 4500,
      sponsorAmount: 0,
      adjustmentAmount: 7000,
    });
  });

  it('allows a custom amount above the standard charge', () => {
    expect(applyFeeAdjustment(1000, {
      feeTypeId: 'activity',
      mode: 'CUSTOM_AMOUNT',
      value: 1250,
    })).toEqual({
      studentAmount: 1250,
      sponsorAmount: 0,
      adjustmentAmount: -250,
    });
  });
});
