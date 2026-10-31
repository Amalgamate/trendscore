'use strict';
// L2C-1-19 — Leads service factory.
// Wraps leadsStore and agentsStore so routes depend on this interface, not the stores directly.

function createLeadsService(leadsStore, agentsStore) {
  return {
    listLeads:             (...args) => leadsStore.listLeads(...args),
    createLead:            (...args) => leadsStore.createLead(...args),
    updateLead:            (...args) => leadsStore.updateLead(...args),
    deleteLead:            (...args) => leadsStore.deleteLead(...args),
    getLead:               (...args) => leadsStore.getLead(...args),
    registerSchoolLead:    (...args) => leadsStore.registerSchoolLead(...args),
    syncProvisionedTenant: (...args) => leadsStore.syncProvisionedTenant(...args),
    // Agent overview — used by /api/agents/overview route
    getAgentsOverview:     ()       => agentsStore.getOverview(),
  };
}

module.exports = { createLeadsService };
