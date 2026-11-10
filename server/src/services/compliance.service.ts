import prisma from '../config/database';
import { FeeInvoice, ComplianceStatus } from '@prisma/client';
import logger from '../utils/logger';

export interface ETIMSPayload {
  invoiceNumber: string;
  customerName: string;
  customerPin?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  totalAmount: number;
  taxAmount: number;
}

export class ComplianceService {
  /**
   * Sync a Fee Invoice with KRA eTIMS (Background Process)
   *
   * NOTE: Real eTIMS API integration is pending. Until the actual KRA
   * integration credentials and endpoint are configured, invoices are
   * marked as NOT_SYNCED rather than generating fake control codes.
   * This prevents schools from believing they are KRA-compliant when
   * they are not.
   *
   * TODO: Implement real eTIMS API call via axios when credentials
   * (KRA_ETIMS_URL, KRA_ETIMS_TOKEN) are available in env.
   */
  async syncInvoiceToETIMS(invoiceId: string) {
    try {
      const invoice = await prisma.feeInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          learner: true,
          feeStructure: {
            include: { feeItems: { include: { feeType: true } } }
          }
        }
      });

      if (!invoice) throw new Error('Invoice not found');

      // Already synced check
      if (invoice.complianceStatus === ComplianceStatus.SYNCED) {
        logger.info(`[Compliance] Invoice ${invoice.invoiceNumber} already synced. Skipping.`);
        return true;
      }

      logger.info(`[Compliance] Preparing eTIMS payload for Invoice ${invoice.invoiceNumber}...`);

      // 1. Prepare eTIMS Payload (kept for when real integration goes live)
      const payload: ETIMSPayload = {
        invoiceNumber: invoice.invoiceNumber,
        customerName: `${invoice.learner.firstName} ${invoice.learner.lastName}`,
        customerPin: (invoice.learner as any).kraPin,
        items: invoice.feeStructure.feeItems.map(item => ({
          name: item.feeType.name,
          quantity: 1,
          unitPrice: Number(item.amount),
          taxRate: 0 // Most school fees are tax exempt (Zero Rated) or Exempt
        })),
        totalAmount: Number(invoice.totalAmount),
        taxAmount: 0
      };

      // 2. Real eTIMS API call is not yet implemented.
      //    Mark as NOT_SYNCED so finance staff know compliance is pending.
      await prisma.feeInvoice.update({
        where: { id: invoiceId },
        data: {
          complianceStatus: ComplianceStatus.NOT_SYNCED,
          etimsControlCode: null,
          etimsQRCodeUrl: null
        }
      });

      logger.info(
        `[Compliance] Invoice ${invoice.invoiceNumber} marked as NOT_SYNCED. ` +
        `eTIMS API integration is pending. Payload prepared with ${payload.items.length} line items.`
      );
      return true;
    } catch (error: any) {
      logger.error(`[Compliance] eTIMS Sync Failed for Invoice ${invoiceId}: ${error?.message ?? error}`);
      // Mark as FAILED so retries and dashboards can surface it
      try {
        await prisma.feeInvoice.update({
          where: { id: invoiceId },
          data: { complianceStatus: ComplianceStatus.FAILED }
        });
      } catch (updateErr: any) {
        logger.error(`[Compliance] Could not mark invoice ${invoiceId} as FAILED: ${updateErr?.message ?? updateErr}`);
      }
      return false;
    }
  }

  /**
   * Generate KRA iTax Payroll CSV (P10)
   */
  async generateITaxPayrollCSV(month: number, year: number) {
    const records = await prisma.payrollRecord.findMany({
      where: { month, year, status: 'GENERATED' },
      include: { user: true }
    });

    if (records.length === 0) return null;

    // Header for KRA iTax P10 Template
    let csv = 'PIN,Name,GrossPay,allowances,NSSF_Contribution,SHIF_Contribution,PAY_Tax\n';

    for (const record of records) {
      const tax = (record.deductions as any) || {};
      csv += `${record.user.kraPin || ''},"${record.user.firstName} ${record.user.lastName}",${record.basicSalary},0,${tax.nssf || 0},${tax.shif || 0},${tax.paye || 0}\n`;
    }

    return csv;
  }

}

export const complianceService = new ComplianceService();
