/**
 * @module lib/schemas/email
 * @description Schema #13 — validação de payloads relacionados a envio de
 *   e-mails: inserts em `email_send_log` e modos aceitos pela edge function
 *   `dispatch-email-digest`.
 */
import { z } from "zod";
import { emptyToNull } from "./_helpers";

// ---------- Constantes ----------

export const EMAIL_STATUS = ["pending", "sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUS)[number];

export const SUBJECT_MAX = 200;
export const BODY_HTML_MAX = 200_000;
export const BODY_TEXT_MAX = 50_000;
export const EMAIL_MAX = 255;
export const LAST_ERROR_MAX = 2000;

// ---------- email_send_log · insert ----------

export const emailSendLogInsertSchema = z.object({
  user_id: z.string().uuid({ message: "user_id inválido" }),
  recipient_email: z
    .string()
    .trim()
    .email({ message: "E-mail do destinatário inválido" })
    .max(EMAIL_MAX, { message: `E-mail muito longo (máx. ${EMAIL_MAX})` }),
  subject: z
    .string()
    .trim()
    .min(1, { message: "Assunto não pode ficar vazio" })
    .max(SUBJECT_MAX, { message: `Assunto muito longo (máx. ${SUBJECT_MAX})` }),
  body_html: z
    .string()
    .min(1, { message: "Corpo HTML não pode ficar vazio" })
    .max(BODY_HTML_MAX, { message: "Corpo HTML muito longo" }),
  body_text: z.preprocess(
    emptyToNull,
    z.string().max(BODY_TEXT_MAX, { message: "Corpo texto muito longo" }).nullable(),
  ),
  status: z.enum(EMAIL_STATUS),
  attempts: z.number().int().min(0).optional(),
  last_error: z.preprocess(
    emptyToNull,
    z.string().max(LAST_ERROR_MAX).nullable().optional(),
  ),
});

export type EmailSendLogInsert = z.infer<typeof emailSendLogInsertSchema>;

// ---------- dispatch-email-digest · mode ----------

export const dispatchDigestModeSchema = z.enum(["imediato", "resumo_diario"]);
export type DispatchDigestMode = z.infer<typeof dispatchDigestModeSchema>;
