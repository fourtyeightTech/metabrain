# Terms and privacy implementation notes

The `/terms` and `/privacy` pages are working draft copy for this application's current functionality. They are not a legal opinion, a guarantee of enforceability or a device for excluding every form of liability. No personal name, address, contact detail, wallet or legal entity has been invented or inserted.

## Scope of the terms

The draft describes an experimental information service and paper simulation. It includes no-advice language, token and model limitations, availability disclaimers, exclusions of legally excludable losses, intended protection for operators and contributors, acceptable-use rules, third-party rights, prospective amendments and severability.

The limitations expressly preserve mandatory consumer rights and liabilities that cannot lawfully be excluded. They do not purport to excuse fraud or wilful misconduct, erase responsibility for separate token-related conduct, create a company, impose an unlimited indemnity or require a foreign forum. A founder cannot obtain guaranteed personal immunity just by posting website terms.

## Operator decisions before adoption

1. Have qualified counsel assess the actual operator, service, target jurisdictions and token-related activities. Public anonymity does not remove legal identification or disclosure duties that may apply. Use appropriate business contact details if required; do not publish personal information from unrelated contexts.
2. Confirm how users will receive notice and, if necessary, accept the terms. This implementation provides visible links. It does not add a mandatory click-through acceptance flow or record consent, and no such evidence should be claimed.
3. Configure `TRAY_PUBLIC_CONTACT_URL` with an HTTPS page that provides an appropriate private contact channel. The value is deliberately public and must not contain credentials. Its value is rendered during the Next.js build; rebuild after changing it. The app does not implement that external contact service.
4. Identify the actual hosting, database, RPC and GPU providers, processing locations, logs and retention periods. Update the privacy notice to match those facts. No universal retention period or promise of zero data collection has been fabricated.
5. Review the rights basis for TRIBE and every dependency model. Website terms do not grant commercial rights or change a model's noncommercial license.
6. If the project later adds wallet connections, financial orders, token sales, user accounts, uploads or paid services, revisit the terms, privacy notice, consent design and regulatory classification before enabling them.

## Sources checked

- [ACCC: Contracts](https://www.accc.gov.au/consumers/buying-products-and-services/contracts) explains protected consumer rights, unfair terms and their possible effect. The draft preserves non-excludable rights instead of promising universal immunity.
- [ACCC: Warranties](https://www.accc.gov.au/consumers/buying-products-and-services/warranties) explains that applicable consumer guarantees cannot be removed by warranty wording.
- [Official TRIBE model card](https://huggingface.co/facebook/tribev2) identifies the model and its CC BY-NC 4.0 license.
- [Creative Commons: CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) describes the noncommercial condition and attribution requirements.

Checked 2026-09-14. Applicable duties depend on the real deployment and activities. The draft intentionally contains no claim that calling an application experimental or displaying a disclaimer settles its legal classification.
