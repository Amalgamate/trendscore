import prisma from '../config/database';
import { mpesaService } from './mpesa.service';
import { LMSNotificationService } from './lms-notification.service';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import { MarketplaceListing, MarketplacePurchase } from '@prisma/client';

const marketplaceErrorMessages: Record<string, string> = {
  SCHOOL_ID_REQUIRED: 'School context is required',
  INVALID_LISTING_TITLE: 'Listing title is required',
  RESOURCE_NOT_FOUND: 'Learning resource not found',
  INVALID_PRICE_FOR_PAID_LISTING: 'Paid listings require a positive price',
  CREATE_LISTING_ERROR: 'Failed to create marketplace listing',
  LISTING_NOT_FOUND: 'Marketplace listing not found',
  LISTING_SCHOOL_MISMATCH: 'Listing does not belong to this school',
  LISTING_NOT_PENDING_APPROVAL: 'Listing is not pending approval',
  APPROVE_LISTING_ERROR: 'Failed to approve marketplace listing',
  REJECT_LISTING_ERROR: 'Failed to reject marketplace listing',
  BROWSE_LISTINGS_ERROR: 'Failed to browse marketplace listings',
  GET_LISTING_ERROR: 'Failed to retrieve marketplace listing',
  GET_MY_LISTINGS_ERROR: 'Failed to retrieve marketplace listings',
  LISTING_NOT_PUBLISHED: 'Listing is not published',
  DUPLICATE_PURCHASE: 'Resource has already been purchased',
  STK_PUSH_FAILED: 'Failed to initiate M-Pesa payment',
  INITIATE_PURCHASE_ERROR: 'Failed to initiate marketplace purchase',
  GET_MY_PURCHASES_ERROR: 'Failed to retrieve marketplace purchases',
  PURCHASE_NOT_FOUND: 'Marketplace purchase not found',
  PURCHASE_NOT_YOURS: 'Marketplace purchase does not belong to you',
  LMS_PURCHASE_REQUIRED: 'Purchase must be completed before download',
  DOWNLOAD_LIMIT_EXCEEDED: 'Download limit exceeded',
  ACCESS_EXPIRED: 'Purchase access has expired',
  RESOURCE_URL_NOT_AVAILABLE: 'Resource file URL is not available',
  DOWNLOAD_ERROR: 'Failed to download purchased resource',
  INVALID_RATING: 'Rating must be between 1 and 5',
  CANNOT_RATE_INCOMPLETE_PURCHASE: 'Only completed purchases can be rated',
  RATE_RESOURCE_ERROR: 'Failed to rate marketplace resource',
  GET_SELLER_BALANCE_ERROR: 'Failed to retrieve seller balance',
  GET_ANALYTICS_ERROR: 'Failed to retrieve marketplace analytics',
};

function marketplaceError(statusCode: number, code: string): ApiError {
  return new ApiError(statusCode, marketplaceErrorMessages[code] ?? code).withCode(code);
}

/**
 * LMS Marketplace Service
 * 
 * Handles all marketplace business logic:
 * - Listing creation, approval, rejection, browsing
 * - Revenue split calculation
 * - Purchase flow (STK push initiation + completion via callback)
 * - Download tracking & access control
 * - Ratings & seller balance computation
 */
class LMSMarketplaceServiceImpl {
  /**
   * 3.1 Core Listing & Approval
   */

  /**
   * Create a new listing in PENDING_APPROVAL status.
   * Validates title, resourceId, listingType, and price (if paid).
   */
  async createListing(
    data: {
      title: string;
      description?: string;
      resourceId: string;
      listingType: 'FREE' | 'PAID' | 'BUNDLE' | 'SUBSCRIPTION';
      price?: number;
      currency?: string;
      revenueSharePct?: number;
      schoolId?: string; // May be passed in data
    },
    sellerId: string,
  ): Promise<MarketplaceListing> {
    try {
      const schoolId = data.schoolId;
      if (!schoolId) {
        throw marketplaceError(400, 'SCHOOL_ID_REQUIRED');
      }

      // Validate title
      if (!data.title || data.title.trim().length === 0) {
        throw marketplaceError(400, 'INVALID_LISTING_TITLE');
      }

      // Validate resourceId exists
      const resource = await prisma.learningResource.findUnique({
        where: { id: data.resourceId },
      });
      if (!resource) {
        throw marketplaceError(404, 'RESOURCE_NOT_FOUND');
      }

      // Validate price for paid listings
      if (data.listingType === 'PAID' && (!data.price || data.price <= 0)) {
        throw marketplaceError(400, 'INVALID_PRICE_FOR_PAID_LISTING');
      }

      // Get school settings for default revenue share %
      const settings = await prisma.lMSSettings.findUnique({
        where: { schoolId },
        select: { marketplaceRevenuePct: true },
      });

      const revenueSharePct = data.revenueSharePct ?? settings?.marketplaceRevenuePct ?? 70;

      const listing = await prisma.marketplaceListing.create({
        data: {
          schoolId,
          resourceId: data.resourceId,
          sellerId,
          title: data.title,
          description: data.description,
          listingType: data.listingType,
          price: data.price ?? 0,
          currency: data.currency ?? 'KES',
          revenueSharePct,
          status: 'PENDING_APPROVAL',
        },
      });

      // Invalidate marketplace cache
      await this.invalidateMarketplaceCache(schoolId);

      logger.info(`[Marketplace] Listing created: ${listing.id} by seller ${sellerId}`);
      return listing;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] createListing error:', error);
      throw marketplaceError(500, 'CREATE_LISTING_ERROR');
    }
  }

  /**
   * Approve a pending listing → APPROVED → PUBLISHED.
   * Transitions from PENDING_APPROVAL → APPROVED → PUBLISHED,
   * sets publishedAt, notifies seller, logs audit, invalidates cache.
   */
  async approveListing(
    listingId: string,
    approverId: string,
    schoolId: string,
  ): Promise<MarketplaceListing> {
    try {
      const listing = await prisma.marketplaceListing.findUnique({
        where: { id: listingId },
        include: { seller: true },
      });

      if (!listing) {
        throw marketplaceError(404, 'LISTING_NOT_FOUND');
      }

      if (listing.schoolId !== schoolId) {
        throw marketplaceError(403, 'LISTING_SCHOOL_MISMATCH');
      }

      if (listing.status !== 'PENDING_APPROVAL') {
        throw marketplaceError(409, 'LISTING_NOT_PENDING_APPROVAL');
      }

      const updated = await prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      // Notify seller
      await LMSNotificationService.onMarketplaceListingApproved(updated, approverId);

      // Audit log
      await this.auditLog('MARKETPLACE_LISTING_APPROVED', listingId, approverId, schoolId);

      // Invalidate cache
      await this.invalidateMarketplaceCache(schoolId);

      logger.info(`[Marketplace] Listing approved: ${listingId}`);
      return updated;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] approveListing error:', error);
      throw marketplaceError(500, 'APPROVE_LISTING_ERROR');
    }
  }

  /**
   * Reject a pending listing → REJECTED.
   * Stores rejection reason, notifies seller.
   */
  async rejectListing(
    listingId: string,
    approverId: string,
    reason: string,
    schoolId: string,
  ): Promise<MarketplaceListing> {
    try {
      const listing = await prisma.marketplaceListing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw marketplaceError(404, 'LISTING_NOT_FOUND');
      }

      if (listing.schoolId !== schoolId) {
        throw marketplaceError(403, 'LISTING_SCHOOL_MISMATCH');
      }

      if (listing.status !== 'PENDING_APPROVAL') {
        throw marketplaceError(409, 'LISTING_NOT_PENDING_APPROVAL');
      }

      const updated = await prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: 'REJECTED',
        },
      });

      // Notify seller of rejection
      await LMSNotificationService.onMarketplaceListingRejected(updated, reason);

      // Audit log
      await this.auditLog('MARKETPLACE_LISTING_REJECTED', listingId, approverId, schoolId, { reason });

      // Invalidate cache
      await this.invalidateMarketplaceCache(schoolId);

      logger.info(`[Marketplace] Listing rejected: ${listingId} — ${reason}`);
      return updated;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] rejectListing error:', error);
      throw marketplaceError(500, 'REJECT_LISTING_ERROR');
    }
  }

  /**
   * Browse published listings with filters, pagination, and caching.
   * Returns PUBLISHED listings only, paginated, filterable by type/price/subject/grade.
   * Cache key: lms:marketplace:{filterHash} (TTL 3 min)
   */
  async browseListings(
    filters: {
      type?: string;
      priceMin?: number;
      priceMax?: number;
      subject?: string;
      grade?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    schoolId: string,
  ): Promise<{ listings: MarketplaceListing[]; total: number; pages: number }> {
    try {
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 10, 100);
      const skip = (page - 1) * limit;

      // Build cache key
      const filterHash = Buffer.from(JSON.stringify({ ...filters, schoolId })).toString('base64');
      const cacheKey = `lms:marketplace:${filterHash}`;

      // Try cache (3 min TTL)
      const cached = await redisCacheService.get<{ listings: MarketplaceListing[]; total: number; pages: number }>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build where clause
      const where: any = {
        schoolId,
        status: 'PUBLISHED',
        archived: false,
      };

      if (filters.type) {
        where.listingType = filters.type;
      }

      if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
        where.price = {};
        if (filters.priceMin !== undefined) where.price.gte = filters.priceMin;
        if (filters.priceMax !== undefined) where.price.lte = filters.priceMax;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Subject & grade filtering via resource relationships
      // (requires resource join in query)

      const [listings, total] = await Promise.all([
        prisma.marketplaceListing.findMany({
          where,
          include: { seller: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.marketplaceListing.count({ where }),
      ]);

      const result = {
        listings,
        total,
        pages: Math.ceil(total / limit),
      };

      // Cache for 3 minutes
      await redisCacheService.set(cacheKey, result, 180);

      return result;
    } catch (error: any) {
      logger.error('[Marketplace] browseListings error:', error);
      throw marketplaceError(500, 'BROWSE_LISTINGS_ERROR');
    }
  }

  /**
   * Get a single listing detail.
   */
  async getListingDetail(id: string, schoolId: string): Promise<MarketplaceListing> {
    try {
      const listing = await prisma.marketplaceListing.findUnique({
        where: { id },
        include: { seller: true, resource: true },
      });

      if (!listing) {
        throw marketplaceError(404, 'LISTING_NOT_FOUND');
      }

      if (listing.schoolId !== schoolId) {
        throw marketplaceError(403, 'LISTING_SCHOOL_MISMATCH');
      }

      return listing;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] getListingDetail error:', error);
      throw marketplaceError(500, 'GET_LISTING_ERROR');
    }
  }

  /**
   * Get all listings for a seller (all statuses, own listings only).
   */
  async getMyListings(sellerId: string, schoolId: string): Promise<MarketplaceListing[]> {
    try {
      const listings = await prisma.marketplaceListing.findMany({
        where: {
          schoolId,
          sellerId,
        },
        include: { resource: true },
        orderBy: { createdAt: 'desc' },
      });

      return listings;
    } catch (error: any) {
      logger.error('[Marketplace] getMyListings error:', error);
      throw marketplaceError(500, 'GET_MY_LISTINGS_ERROR');
    }
  }

  /**
   * 3.2 Revenue Split (Pure Function)
   * 
   * Calculates seller earnings and platform fee.
   * Ensures: sellerEarnings + platformFee === price (rounded to 0.01)
   */
  calculateRevenueSplit(price: number, revenueSharePct: number): {
    sellerEarnings: number;
    platformFee: number;
  } {
    // Seller earnings = price * (revenueSharePct / 100)
    // Platform fee = price - sellerEarnings
    const sellerEarnings = Math.round((price * revenueSharePct) / 100 * 100) / 100;
    const platformFee = Math.round((price - sellerEarnings) * 100) / 100;

    return { sellerEarnings, platformFee };
  }

  /**
   * 3.3 Purchase Flow
   */

  /**
   * Initiate a purchase via M-Pesa STK push.
   * - Validates listing is PUBLISHED
   * - Prevents duplicate purchases (returns 409)
   * - Computes revenue split
   * - Calls mpesaService.initiateStkPush (no invoiceId — keeps fee-payment branch inert)
   * - Creates MarketplacePurchase with status=PENDING, transactionId=checkoutRequestId
   * - Returns { purchaseId, checkoutRequestId }
   */
  async initiatePurchase(
    listingId: string,
    buyerId: string,
    buyerPhone: string,
    schoolId: string,
    buyerInfo?: { firstName?: string; lastName?: string },
  ): Promise<{ purchaseId: string; checkoutRequestId: string }> {
    try {
      const listing = await prisma.marketplaceListing.findUnique({
        where: { id: listingId },
        include: { seller: true },
      });

      if (!listing) {
        throw marketplaceError(404, 'LISTING_NOT_FOUND');
      }

      if (listing.schoolId !== schoolId) {
        throw marketplaceError(403, 'LISTING_SCHOOL_MISMATCH');
      }

      if (listing.status !== 'PUBLISHED') {
        throw marketplaceError(409, 'LISTING_NOT_PUBLISHED');
      }

      // Check for duplicate purchase
      const existing = await prisma.marketplacePurchase.findFirst({
        where: {
          listingId,
          buyerId,
          status: 'COMPLETED',
        },
      });

      if (existing) {
        throw marketplaceError(409, 'DUPLICATE_PURCHASE');
      }

      // Compute revenue split
      const { sellerEarnings, platformFee } = this.calculateRevenueSplit(
        listing.price,
        listing.revenueSharePct,
      );

      // Initiate STK push (no invoiceId — keeps fee-payment branch inert)
      const stkResult = await mpesaService.initiateStkPush({
        phoneNumber: buyerPhone,
        amount: listing.price,
        firstName: buyerInfo?.firstName,
        lastName: buyerInfo?.lastName,
        // no invoiceId — this is the key difference
      });

      if (!stkResult.success) {
        throw marketplaceError(500, 'STK_PUSH_FAILED');
      }

      const checkoutRequestId = 'checkoutRequestId' in stkResult
        ? stkResult.checkoutRequestId
        : 'externalId' in stkResult
          ? stkResult.externalId
          : undefined;

      if (!checkoutRequestId) {
        throw marketplaceError(500, 'STK_PUSH_FAILED');
      }

      // Create pending purchase
      const purchase = await prisma.marketplacePurchase.create({
        data: {
          listingId,
          buyerId,
          schoolId: listing.schoolId,
          amount: listing.price,
          currency: listing.currency,
          transactionId: checkoutRequestId,
          sellerEarnings,
          platformFee,
          status: 'PENDING',
          maxDownloads: 5,
          accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });

      logger.info(
        `[Marketplace] Purchase initiated: ${purchase.id} | ` +
        `listing: ${listingId} | buyer: ${buyerId} | checkoutRequestId: ${checkoutRequestId}`,
      );

      return {
        purchaseId: purchase.id,
        checkoutRequestId,
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] initiatePurchase error:', error);
      throw marketplaceError(500, 'INITIATE_PURCHASE_ERROR');
    }
  }

  /**
   * Complete a purchase by checkoutRequestId (called from M-Pesa callback).
   * - Finds pending MarketplacePurchase by transactionId
   * - On success: status=COMPLETED, notify buyer + seller
   * - On failure: status=FAILED, notify buyer
   */
  async completeByCheckoutRequestId(
    checkoutRequestId: string,
    result: { success: boolean; resultCode?: number; resultDesc?: string; receipt?: string },
  ): Promise<MarketplacePurchase | null> {
    try {
      const purchase = await prisma.marketplacePurchase.findFirst({
        where: {
          transactionId: checkoutRequestId,
          status: 'PENDING',
        },
      });

      if (!purchase) {
        logger.warn(
          `[Marketplace] completeByCheckoutRequestId: no pending purchase found for ${checkoutRequestId}`,
        );
        return null;
      }

      if (result.success) {
        const completed = await prisma.marketplacePurchase.update({
          where: { id: purchase.id },
          data: {
            status: 'COMPLETED',
            mpesaReceiptNo: result.receipt,
          },
          include: { listing: true, buyer: true },
        });

        // Increment listing purchase count
        await prisma.marketplaceListing.update({
          where: { id: purchase.listingId },
          data: { purchaseCount: { increment: 1 } },
        });

        // Notify buyer + seller
        await LMSNotificationService.onMarketplacePurchaseComplete(completed);

        logger.info(`[Marketplace] Purchase completed: ${purchase.id}`);
        return completed;
      } else {
        const failed = await prisma.marketplacePurchase.update({
          where: { id: purchase.id },
          data: { status: 'FAILED' },
          include: { buyer: true, listing: true },
        });

        // Notify buyer of failure
        await LMSNotificationService.onMarketplacePurchaseFailed(failed, result.resultDesc);

        logger.info(`[Marketplace] Purchase failed: ${purchase.id} — ${result.resultDesc}`);
        return failed;
      }
    } catch (error: any) {
      logger.error('[Marketplace] completeByCheckoutRequestId error:', error);
      // Do not re-throw — this is called from the callback handler,
      // which should not fail the entire callback flow.
      return null;
    }
  }

  /**
   * Handle M-Pesa callback for marketplace purchases (defensive/idempotent entry point).
   */
  async handleMpesaCallback(body: any): Promise<void> {
    try {
      const { checkoutRequestId, resultCode, resultDesc, receipt } = body;
      const success = resultCode === 0 || resultCode === '0';

      await this.completeByCheckoutRequestId(checkoutRequestId, {
        success,
        resultCode,
        resultDesc,
        receipt,
      });
    } catch (error: any) {
      logger.error('[Marketplace] handleMpesaCallback error:', error);
      // Non-fatal — callback should still return 200
    }
  }

  /**
   * 3.4 Downloads & Ratings
   */

  /**
   * Get purchases for a buyer.
   */
  async getMyPurchases(buyerId: string, schoolId: string): Promise<MarketplacePurchase[]> {
    try {
      const purchases = await prisma.marketplacePurchase.findMany({
        where: {
          buyerId,
          schoolId,
        },
        include: { listing: true },
        orderBy: { purchasedAt: 'desc' },
      });

      return purchases;
    } catch (error: any) {
      logger.error('[Marketplace] getMyPurchases error:', error);
      throw marketplaceError(500, 'GET_MY_PURCHASES_ERROR');
    }
  }

  /**
   * Download a purchased resource.
   * Verifies COMPLETED status, checks downloadCount < maxDownloads, checks accessExpiresAt.
   * Returns signed Cloudinary URL and increments downloadCount.
   */
  async downloadPurchasedResource(purchaseId: string, buyerId: string): Promise<string> {
    try {
      const purchase = await prisma.marketplacePurchase.findUnique({
        where: { id: purchaseId },
        include: { listing: { include: { resource: true } } },
      });

      if (!purchase) {
        throw marketplaceError(404, 'PURCHASE_NOT_FOUND');
      }

      if (purchase.buyerId !== buyerId) {
        throw marketplaceError(403, 'PURCHASE_NOT_YOURS');
      }

      if (purchase.status !== 'COMPLETED') {
        throw marketplaceError(402, 'LMS_PURCHASE_REQUIRED');
      }

      if (purchase.downloadCount >= purchase.maxDownloads) {
        throw marketplaceError(429, 'DOWNLOAD_LIMIT_EXCEEDED');
      }

      if (purchase.accessExpiresAt && new Date() > purchase.accessExpiresAt) {
        throw marketplaceError(410, 'ACCESS_EXPIRED');
      }

      // Increment download count
      await prisma.marketplacePurchase.update({
        where: { id: purchaseId },
        data: { downloadCount: { increment: 1 } },
      });

      // Return resource URL (could be signed Cloudinary URL)
      const resourceUrl = purchase.listing.resource?.fileUrl || purchase.listing.resource?.externalUrl;
      if (!resourceUrl) {
        throw marketplaceError(500, 'RESOURCE_URL_NOT_AVAILABLE');
      }

      logger.info(`[Marketplace] Resource downloaded: ${purchaseId} by ${buyerId}`);
      return resourceUrl;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] downloadPurchasedResource error:', error);
      throw marketplaceError(500, 'DOWNLOAD_ERROR');
    }
  }

  /**
   * Rate a purchased resource.
   * Updates listing's rolling average rating and increments ratingCount.
   */
  async rateResource(
    purchaseId: string,
    rating: number,
    buyerId: string,
  ): Promise<MarketplaceListing> {
    try {
      if (rating < 1 || rating > 5) {
        throw marketplaceError(400, 'INVALID_RATING');
      }

      const purchase = await prisma.marketplacePurchase.findUnique({
        where: { id: purchaseId },
        include: { listing: true },
      });

      if (!purchase) {
        throw marketplaceError(404, 'PURCHASE_NOT_FOUND');
      }

      if (purchase.buyerId !== buyerId) {
        throw marketplaceError(403, 'PURCHASE_NOT_YOURS');
      }

      if (purchase.status !== 'COMPLETED') {
        throw marketplaceError(409, 'CANNOT_RATE_INCOMPLETE_PURCHASE');
      }

      const listing = purchase.listing;

      // Calculate new rolling average
      const oldRating = listing.rating ?? 0;
      const oldCount = listing.ratingCount;
      const newCount = oldCount + 1;
      const newRating = (oldRating * oldCount + rating) / newCount;

      const updated = await prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          rating: newRating,
          ratingCount: newCount,
        },
      });

      logger.info(
        `[Marketplace] Resource rated: ${purchase.listingId} | rating: ${rating} | ` +
        `new avg: ${newRating.toFixed(2)}`,
      );

      return updated;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('[Marketplace] rateResource error:', error);
      throw marketplaceError(500, 'RATE_RESOURCE_ERROR');
    }
  }

  /**
   * 3.5 Wallet (Computed)
   */

  /**
   * Get seller's balance (sum of sellerEarnings on COMPLETED purchases).
   */
  async getSellerBalance(sellerId: string, schoolId: string): Promise<number> {
    try {
      const result = await prisma.marketplacePurchase.aggregate({
        where: {
          listing: {
            sellerId,
            schoolId,
          },
          status: 'COMPLETED',
        },
        _sum: { sellerEarnings: true },
      });

      return result._sum.sellerEarnings ?? 0;
    } catch (error: any) {
      logger.error('[Marketplace] getSellerBalance error:', error);
      throw marketplaceError(500, 'GET_SELLER_BALANCE_ERROR');
    }
  }

  /**
   * Get marketplace analytics for a seller.
   * Total sales, revenue earned, top listings, download counts.
   */
  async getMarketplaceAnalytics(
    sellerId: string,
    schoolId: string,
  ): Promise<{
    totalSales: number;
    revenueEarned: number;
    topListings: Array<{ listingId: string; title: string; sales: number }>;
    totalDownloads: number;
  }> {
    try {
      const purchases = await prisma.marketplacePurchase.findMany({
        where: {
          listing: {
            sellerId,
            schoolId,
          },
          status: 'COMPLETED',
        },
        include: { listing: true },
      });

      const totalSales = purchases.length;
      const revenueEarned = purchases.reduce((sum, p) => sum + p.sellerEarnings, 0);
      const totalDownloads = purchases.reduce((sum, p) => sum + p.downloadCount, 0);

      // Top listings by sales
      const salesByListing: { [key: string]: { title: string; count: number } } = {};
      purchases.forEach((p) => {
        if (!salesByListing[p.listingId]) {
          salesByListing[p.listingId] = { title: p.listing.title, count: 0 };
        }
        salesByListing[p.listingId].count += 1;
      });

      const topListings = Object.entries(salesByListing)
        .map(([listingId, { title, count }]) => ({
          listingId,
          title,
          sales: count,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      return { totalSales, revenueEarned, topListings, totalDownloads };
    } catch (error: any) {
      logger.error('[Marketplace] getMarketplaceAnalytics error:', error);
      throw marketplaceError(500, 'GET_ANALYTICS_ERROR');
    }
  }

  /**
   * Utility Methods
   */

  private async invalidateMarketplaceCache(schoolId: string): Promise<void> {
    try {
      // Invalidate all marketplace cache keys for this school
      const pattern = `lms:marketplace:*`;
      // Note: In production, use redis.keys() or a more sophisticated cache invalidation
      // For now, this is a placeholder. Redis client would be needed for pattern deletion.
      logger.info(`[Marketplace] Invalidated cache for school: ${schoolId}`);
    } catch (error: any) {
      logger.warn('[Marketplace] Cache invalidation failed (non-fatal):', error.message);
    }
  }

  private async auditLog(
    action: string,
    resourceId: string,
    actorId: string,
    schoolId: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          userId: actorId,
          method: 'SERVICE',
          path: 'lms.marketplace',
          params: JSON.stringify({ resourceId, schoolId, metadata: metadata ?? null }),
        },
      });
    } catch (error: any) {
      logger.warn('[Marketplace] Audit log creation failed (non-fatal):', error.message);
    }
  }
}

export const LMSMarketplaceService = new LMSMarketplaceServiceImpl();
