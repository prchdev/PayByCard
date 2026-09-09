import { paybycardAcceptedTermsBase64 } from "./paybycard-accepted-terms.base64.ts";

const attachmentFilename = "PayByCard_-_Accepted_Term_&_Conditions.pdf";

export function getKycPolicyAttachment(): Promise<{
  attachment_base64: string;
  attachment_filename: string;
  attachment_content_type: string;
}> {
  return Promise.resolve({
    attachment_base64: paybycardAcceptedTermsBase64,
    attachment_filename: attachmentFilename,
    attachment_content_type: "application/pdf",
  });
}
