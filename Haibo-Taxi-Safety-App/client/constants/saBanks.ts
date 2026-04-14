// South African bank codes as used by Paystack's /bank API for ZAR EFT
// transfers. Subset covering the banks that together serve ~95% of retail
// customers in SA. Full list changes rarely — rebuild when Paystack ships
// new participants.
//
// The server's /api/wallet/withdraw route stores bankCode as a text field
// and passes it to operators for manual EFT fulfilment, so getting the code
// exactly right matters for downstream processing.

export interface SABank {
  code: string;
  name: string;
}

export const SA_BANKS: SABank[] = [
  { code: "470010", name: "Capitec Bank" },
  { code: "250655", name: "First National Bank (FNB)" },
  { code: "051001", name: "Standard Bank" },
  { code: "632005", name: "Absa" },
  { code: "198765", name: "Nedbank" },
  { code: "678910", name: "TymeBank" },
  { code: "430000", name: "African Bank" },
  { code: "679000", name: "Discovery Bank" },
  { code: "460005", name: "Bidvest Bank" },
  { code: "800000", name: "Other" },
];
