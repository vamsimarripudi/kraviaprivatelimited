export type IntegrationHealth = "OPERATIONAL" | "DEGRADED" | "DISCONNECTED" | "CONFIGURATION_REQUIRED";
export type TransactionalMessage = { to: string; subject: string; text: string; category: "corporate" | "compliance" | "board" | "security" | "privacy" | "system" };
export interface EmailProvider { send(message: TransactionalMessage): Promise<{ providerMessageId: string }>; health(): Promise<IntegrationHealth>; }
export interface BankDataProvider { health(): Promise<IntegrationHealth>; }
export interface ESignProvider { health(): Promise<IntegrationHealth>; }
export class ConfigurationRequiredEmailProvider implements EmailProvider { async send(_message: TransactionalMessage): Promise<{ providerMessageId: string }> { throw new Error("Corporate email provider is not configured."); } async health(): Promise<IntegrationHealth> { return "CONFIGURATION_REQUIRED"; } }
