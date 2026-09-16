export const publicFormKeys = ["CONTACT", "SUPPORT", "TRUST_REQUEST"] as const;
export type PublicFormKey = (typeof publicFormKeys)[number];

export type PublicFormSetting = {
  formKey: PublicFormKey;
  title: string | null;
  intro: string | null;
  submitLabel: string | null;
  successHeading: string | null;
  successMessage: string | null;
  isEnabled: boolean;
  updatedAt: string;
};

export type PublicFormPresentation = Pick<PublicFormSetting, "title" | "intro" | "submitLabel" | "successHeading" | "successMessage">;
