# HyperAI Privacy Notice — Draft for Legal Review

**Status: DRAFT — NOT APPROVED FOR PUBLIC RELEASE**  
**Proposed effective date:** Not set  
**Last source review:** 31 October 2026

> This draft is based on a source-code review of the repository. It is not legal advice and does not prove compliance. The responsible operator must complete every `[PLACEHOLDER]`, verify hosting/provider settings, and obtain qualified legal review before public use.

## 1. Who operates HyperAI

HyperAI is a web client that sends chat requests to OpenRouter and, depending on the selected model, onward to a model provider.

- **Data controller / operator legal name:** [PLACEHOLDER — adult individual or legal entity]
- **Business/legal status:** [PLACEHOLDER]
- **Privacy contact:** [PLACEHOLDER — monitored email address]
- **Postal/contact address:** [PLACEHOLDER — legally appropriate contact address]
- **Service URL:** [PLACEHOLDER — production URL]

Do not publish this notice while the operator identity and privacy contact remain blank. A project handle or social-media profile is not a substitute for the legal identity/contact details required for the service's circumstances.

## 2. Who may use the service

The upstream OpenRouter Terms of Service state that a person must be at least 18 years old to use the OpenRouter Service. HyperAI therefore must not be offered as an OpenRouter-backed service to people under 18 unless the provider gives a different, written authorization that clearly covers the proposed use. Do not falsify age or use another person's account to avoid this requirement.

The operator must be an adult authorized to accept the provider terms and operate the service. See [OpenRouter Terms, section 2](https://openrouter.ai/terms).

## 3. Information processed

Based on the source code reviewed on 31 October 2026:

### Information a user submits
- Chat prompt and conversation messages included in the request.
- Selected model identifier.
- Thinking/reasoning preference.
- Whether the optional web-search setting was requested.

The browser sends the conversation payload to HyperAI's `POST /api/chat` endpoint. The backend adds its system instruction and sends the request to OpenRouter. The selected model provider may then process the prompt and generated output.

### Browser preferences
The frontend uses browser `localStorage` for:
- `hyperai.theme`
- `hyperai.advancedMotion`
- `hyperai.model`
- `hyperai.thinking`

These values represent interface preferences, not a chat-history database. They remain in the browser until changed or cleared by the user/browser.

### Technical and operational information
The hosting platform, network providers, and upstream API may process technical information such as IP address, request metadata, browser/device information, security events, and operational logs under their own terms and configurations. The exact fields and retention periods must be confirmed against the deployed platform configuration before this notice is finalized.

## 4. Information the current application does not intentionally persist

The source review found no application code using `document.cookie` or `sessionStorage`, and no application-managed database or server-side chat-history store in the inspected repository. The chat transcript is held in frontend memory during the active page session.

This is a source-code observation, not a guarantee that Vercel, OpenRouter, model providers, browsers, network intermediaries, or security systems never create logs or retain request data. Do not promise "zero retention" unless each relevant provider setting and contract has been verified.

## 5. Purposes

Subject to the operator's final documented legal basis, the service may process information to:
- receive and answer a chat request;
- route a request to the selected model;
- maintain service security and availability;
- investigate faults, abuse, and service incidents;
- comply with legal obligations.

The operator must identify and document the applicable lawful basis for each purpose under applicable data-protection law. Do not claim that consent is the sole or universal legal basis.

## 6. Service providers and disclosures

Depending on the deployment and model selected, information may be processed by:
- **Vercel** — hosting and serverless infrastructure, if the service is deployed there;
- **OpenRouter** — model API aggregation and routing;
- **Model providers** — the provider serving the selected model;
- **GitHub** — repository hosting and development workflows; not identified in the inspected runtime code as a recipient of chat prompts.

OpenRouter states that it does not use Inputs or Outputs to train its own models, but model providers may have different retention and training practices. Users and the operator must review the applicable provider/model terms before enabling a model. See [OpenRouter Privacy Policy](https://openrouter.ai/privacy/) and [Model Terms](https://openrouter.ai/models).

## 7. International processing

The service providers and model providers may process information in countries other than the user's country or the operator's country. Before public operation, the operator must identify the actual processing locations, assess cross-border transfer requirements, and put required safeguards/contracts in place. This notice does not assert that such safeguards are already in place.

## 8. Retention

- **Chat history in the application:** no persistent chat-history storage was found in the inspected frontend/backend source.
- **Browser preferences:** retained in localStorage until the user clears them or browser storage is removed.
- **Hosting/security logs:** [PLACEHOLDER — verify Vercel project settings, log availability, retention and contractual terms].
- **OpenRouter/model-provider records:** governed by the current provider policies, selected model terms, and account settings; do not promise a fixed retention period without verification.

The operator must define a retention schedule for every data category it controls and ensure deletion/retention procedures are operational.

## 9. Data subject rights and requests

Subject to applicable law, a person may request access, correction, deletion, restriction, objection, withdrawal of consent where consent is the basis, or other rights available under applicable law.

Submit a request to: **[PLACEHOLDER — privacy contact]**. The operator must verify the requester appropriately, respond within applicable statutory periods, and explain any lawful reason for refusing or limiting a request.

## 10. Security

The repository keeps the OpenRouter API key server-side and includes model allowlisting and request validation. These controls reduce some risks but do not guarantee security. The operator must also review authentication/abuse controls, rate limits, hosting access, secrets, logging, incident response, and provider configuration before public operation.

## 11. Children and sensitive information

Because the upstream OpenRouter Service requires users to be at least 18, HyperAI must not invite or knowingly process chat requests from under-18 users under the current integration. Do not submit another person's sensitive information, credentials, health, financial, biometric, or identity information unless there is a valid legal basis and all required safeguards and notices are in place.

## 12. Changes and contact

Material changes to processing must be reflected in this notice before they take effect where required. The operator must provide a visible version date and a working contact channel.

**Privacy contact:** [PLACEHOLDER]

## 13. Legal references

- Indonesia, [Law No. 27 of 2022 on Personal Data Protection](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022).
- Indonesia, [Government Regulation No. 71 of 2019](https://jdih.komdigi.go.id/produk_hukum/view/id/695/t/peraturan%2Bpemerintah%2Bnomor%2B71%2Btahun%2B10%2Boktober%2B2019).
- [OpenRouter Privacy Policy](https://openrouter.ai/privacy/).
- [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice).

This list is informational and is not an exhaustive statement of laws that may apply.
