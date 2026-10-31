'use strict';
// L2C-1-19 — Billing service factory.
// Wraps billingStore methods so routes depend on this interface, not the store directly.
// All methods delegate 1-to-1; this is the seam for future business logic.

function createBillingService(billingStore) {
  return {
    listCustomers:         (...args) => billingStore.listCustomers(...args),
    getCustomer:           (...args) => billingStore.getCustomer(...args),
    getCustomerByTenantKey:(...args) => billingStore.getCustomerByTenantKey(...args),
    createCustomer:        (...args) => billingStore.createCustomer(...args),
    updateCustomer:        (...args) => billingStore.updateCustomer(...args),
    listContracts:         (...args) => billingStore.listContracts(...args),
    createContract:        (...args) => billingStore.createContract(...args),
    updateContract:        (...args) => billingStore.updateContract(...args),
    listQuotes:            (...args) => billingStore.listQuotes(...args),
    getQuote:              (...args) => billingStore.getQuote(...args),
    createQuote:           (...args) => billingStore.createQuote(...args),
    updateQuote:           (...args) => billingStore.updateQuote(...args),
    setQuoteStatus:        (...args) => billingStore.setQuoteStatus(...args),
    deleteDraftQuote:      (...args) => billingStore.deleteDraftQuote(...args),
    cancelQuote:           (...args) => billingStore.cancelQuote(...args),
    getInvoiceForQuote:    (...args) => billingStore.getInvoiceForQuote(...args),
    listInvoices:          (...args) => billingStore.listInvoices(...args),
    getInvoice:            (...args) => billingStore.getInvoice(...args),
    createDraftInvoice:    (...args) => billingStore.createDraftInvoice(...args),
    updateDraftInvoice:    (...args) => billingStore.updateDraftInvoice(...args),
    issueDraftInvoice:     (...args) => billingStore.issueDraftInvoice(...args),
    cancelDraftInvoice:    (...args) => billingStore.cancelDraftInvoice(...args),
    listPayments:          (...args) => billingStore.listPayments(...args),
    getPayment:            (...args) => billingStore.getPayment(...args),
    recordPayment:         (...args) => billingStore.recordPayment(...args),
    listProducts:          (...args) => billingStore.listProducts(...args),
    getProduct:            (...args) => billingStore.getProduct(...args),
    updateProduct:         (...args) => billingStore.updateProduct(...args),
    recordQuoteDelivery:   (...args) => billingStore.recordQuoteDelivery(...args),
    listQuoteDeliveries:   (...args) => billingStore.listQuoteDeliveries(...args),
    recordInvoiceDelivery: (...args) => billingStore.recordInvoiceDelivery(...args),
    listInvoiceDeliveries: (...args) => billingStore.listInvoiceDeliveries(...args),
    resetAll:              (...args) => billingStore.resetAll(...args),
  };
}

module.exports = { createBillingService };
