import type { ReactNode } from "react";
import {
  type CompanyProfile,
  emptyProfile,
  FIELD_BY_KEY,
  INDIAN_STATES,
  type ProfileField,
} from "../domain/companyProfile";
import { maskSecret } from "../domain/employees";
import { plainRupees } from "../domain/money";

/** The company columns the form edits. A new company has none yet. */
export type CompanyFormValues = {
  number: string;
  shortName: string;
  name: string;
  location: string;
  city: string;
  state: string;
  professionalTax: boolean;
  pfEmployeePercent: number | null;
  pfLimitPaise: number | null;
  esiEmployeePercent: number | null;
  esiExceptionLimitPaise: number;
  profile: CompanyProfile;
};

export type FieldQuery = Record<string, string | undefined>;

type Context = {
  profile: CompanyProfile;
  query: FieldQuery;
  editable: boolean;
  banks: string[];
  /** Keeps element ids unique when two company forms share a page. */
  prefix: string;
};

/** What the field holds on screen: the draft after a refused save, else what is stored. */
function shown(context: Context, field: ProfileField): string {
  const { profile, query } = context;
  if (query.error && query.draft && field.kind !== "secret") {
    return query[field.key] ?? "";
  }
  const value = profile[field.key];
  if (field.kind === "secret") return maskSecret(String(value));
  if (field.kind === "money") {
    return typeof value === "number" ? plainRupees(value) : "";
  }
  if (field.kind === "rate") {
    return typeof value === "number" ? String(value) : "";
  }
  return String(value ?? "");
}

function checked(context: Context, field: ProfileField): boolean {
  if (context.query.error && context.query.draft) {
    return context.query[field.key] === "on";
  }
  return context.profile[field.key] === true;
}

function Field({
  context,
  name,
  wide,
  help,
}: {
  context: Context;
  name: ProfileField["key"];
  wide?: boolean;
  help?: string;
}) {
  const field = FIELD_BY_KEY[name];
  const { editable } = context;
  const value = shown(context, field);
  const className = wide ? "wide" : undefined;
  const note = help ?? field.help;
  const id = `${context.prefix}field-${field.key}`;
  const listId = `${context.prefix}list-${field.key}`;

  if (field.kind === "check") {
    return (
      <label className={`check ${className ?? ""}`.trim()}>
        <input
          name={field.key}
          type="checkbox"
          defaultChecked={checked(context, field)}
          disabled={!editable}
        />
        {field.label}
      </label>
    );
  }

  if (field.kind === "radio") {
    const options = [{ value: "", label: "Not set" }, ...(field.options ?? [])];
    return (
      <fieldset className={`radio-group ${className ?? ""}`.trim()}>
        <legend>{field.label}</legend>
        {options.map((option) => (
          <label key={option.value || "none"} className="radio">
            <input
              type="radio"
              name={field.key}
              value={option.value}
              defaultChecked={value === option.value}
              disabled={!editable}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }

  let control: ReactNode;
  if (field.kind === "textarea") {
    control = (
      <textarea
        id={id}
        name={field.key}
        rows={3}
        maxLength={field.max}
        defaultValue={value}
        readOnly={!editable}
      />
    );
  } else if (field.kind === "bank") {
    const banks =
      value && !context.banks.includes(value)
        ? [value, ...context.banks]
        : context.banks;
    control = (
      <select
        id={id}
        name={field.key}
        defaultValue={value}
        disabled={!editable}
      >
        <option value="">Select</option>
        {banks.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "choice") {
    control = (
      <>
        <input
          id={id}
          name={field.key}
          list={listId}
          maxLength={field.max ?? 40}
          defaultValue={value}
          readOnly={!editable}
          autoComplete="off"
        />
        <datalist id={listId}>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      </>
    );
  } else {
    const type =
      field.kind === "email"
        ? "email"
        : field.kind === "phone"
          ? "tel"
          : field.kind === "date"
            ? "date"
            : "text";
    const inputMode =
      field.kind === "rate" || field.kind === "money"
        ? "decimal"
        : field.kind === "pin"
          ? "numeric"
          : undefined;
    control = (
      <input
        id={id}
        name={field.key}
        type={type}
        inputMode={inputMode}
        maxLength={
          field.kind === "pin"
            ? 6
            : field.kind === "date" ||
                field.kind === "rate" ||
                field.kind === "money"
              ? undefined
              : (field.max ?? 80)
        }
        defaultValue={value}
        readOnly={!editable}
        autoComplete={field.kind === "secret" ? "off" : undefined}
        className={field.format?.upper ? "upper" : undefined}
      />
    );
  }

  return (
    <label className={className} htmlFor={id}>
      <span>{field.label}</span>
      {control}
      {field.kind === "secret" ? (
        <span className="help">
          Shown with most characters hidden. Leave it as shown to keep it.
        </span>
      ) : null}
      {note ? <span className="help">{note}</span> : null}
    </label>
  );
}

/** A company column that is not a profile field: identity and the payroll settings. */
function Plain({
  context,
  name,
  label,
  defaultValue,
  inputMode,
  placeholder,
  help,
  required,
  maxLength,
}: {
  context: Context;
  name: string;
  label: string;
  defaultValue: string;
  inputMode?: "decimal";
  placeholder?: string;
  help?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const { query, editable } = context;
  const value =
    query.error && query.draft && query[name] !== undefined
      ? (query[name] ?? "")
      : defaultValue;
  const id = `${context.prefix}plain-${name}`;
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        defaultValue={value}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        readOnly={!editable}
      />
      {help ? <span className="help">{help}</span> : null}
    </label>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <div>
          <h2 id={id}>{title}</h2>
          {note ? <p>{note}</p> : null}
        </div>
      </div>
      <div className="field-grid">{children}</div>
    </section>
  );
}

/**
 * Every company field in its sections: the same set for editing a company and
 * for creating a company or a site. With no `company` every value starts blank
 * and the company number shows that it is assigned on save.
 */
export function CompanyFieldSections({
  company,
  query,
  editable = true,
  banks,
  prefix = "",
}: {
  company?: CompanyFormValues;
  query: FieldQuery;
  editable?: boolean;
  banks: string[];
  prefix?: string;
}) {
  const profile = company?.profile ?? emptyProfile();
  const context: Context = { profile, query, editable, banks, prefix };
  const draft = Boolean(query.error && query.draft);
  const professionalTax = draft
    ? query.professionalTax === "on"
    : (company?.professionalTax ?? false);
  const id = (name: string) => `${prefix}${name}`;

  return (
    <div className="profile-grid">
      <Section id={id("company-details")} title="Company details">
        <Plain
          context={context}
          name="shortName"
          label="Short name"
          defaultValue={company?.shortName ?? ""}
          required
          maxLength={20}
        />
        <label htmlFor={id("company-number")}>
          <span>Company number</span>
          <input
            id={id("company-number")}
            value={company?.number ?? "Assigned on save"}
            readOnly
          />
        </label>
        <Field context={context} name="estType" />
        <Plain
          context={context}
          name="name"
          label="Company name"
          defaultValue={company?.name ?? ""}
          required
          maxLength={120}
        />
        <Field context={context} name="address" wide />
        <Field context={context} name="email" />
        <Field context={context} name="phone" />
        <Plain
          context={context}
          name="location"
          label="Branch / location"
          defaultValue={company?.location ?? ""}
          maxLength={80}
        />
        <Plain
          context={context}
          name="city"
          label="City"
          defaultValue={company?.city ?? ""}
          maxLength={80}
        />
        <Field context={context} name="district" />
        <label htmlFor={id("plain-state")}>
          <span>State</span>
          <input
            id={id("plain-state")}
            name="state"
            list={id("list-state")}
            maxLength={80}
            autoComplete="off"
            defaultValue={draft ? (query.state ?? "") : (company?.state ?? "")}
            readOnly={!editable}
          />
          <datalist id={id("list-state")}>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state} />
            ))}
          </datalist>
          <span className="help">
            Professional tax slabs are matched on this state, so spell it the
            way the slab list does.
          </span>
        </label>
        <Field context={context} name="pinCode" />
        <Field context={context} name="companyView" />
        <Field context={context} name="companyStatus" />
      </Section>

      <div className="profile-stack">
        <section className="panel" aria-labelledby={id("company-logo")}>
          <div className="panel-head">
            <div>
              <h2 id={id("company-logo")}>Company logo</h2>
              <p>PNG or JPEG, up to 150 KB.</p>
            </div>
          </div>
          <div className="logo-row">
            <div className="logo-box">
              {profile.logo ? (
                // biome-ignore lint/performance/noImgElement: a stored data URL cannot use the image optimiser
                <img
                  src={profile.logo}
                  alt={`${company?.name ?? "Company"} logo`}
                />
              ) : (
                <span>No logo</span>
              )}
            </div>
            {editable ? (
              <div className="logo-controls">
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg"
                  aria-label="Choose a logo file"
                />
                {profile.logo ? (
                  <label className="check">
                    <input name="removeLogo" type="checkbox" />
                    Remove the current logo
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <Section
          id={id("company-bank")}
          title="Company bank"
          note="Account number is shown with most characters hidden."
        >
          <Field context={context} name="bankName" />
          <Field context={context} name="bankIfsc" />
          <Field context={context} name="bankAccount" />
          <Field context={context} name="bankAddress" wide />
        </Section>
      </div>

      <Section
        id={id("unit-details")}
        title="Name and details of contractor / unit"
      >
        <Field context={context} name="unitEstType" />
        <Field context={context} name="unitName" />
        <Field context={context} name="unitAddress" wide />
        <Field context={context} name="ptAsPerEmployeeState" wide />
        <label className="check wide">
          <input
            name="professionalTax"
            type="checkbox"
            defaultChecked={professionalTax}
            disabled={!editable}
          />
          Professional tax
        </label>
        <Field context={context} name="itAuto" wide />
        <Field context={context} name="ptNumber" />
        <Field context={context} name="panNo" />
        <Field context={context} name="tanNo" />
      </Section>

      <Section
        id={id("pay-rules")}
        title="Pay rules"
        note="Recorded as the company states them. Process salary does not use these yet, because the rule behind each one is not confirmed."
      >
        <Field context={context} name="payScaleOn" />
        <Field context={context} name="leaveMethod" />
        <Field context={context} name="leaveCalOn" />
        <Field context={context} name="minWageLimitPaise" />
        <Field context={context} name="bonusPercent" />
        <Field context={context} name="bonusLimitPaise" />
        <Field context={context} name="otOn" />
        <Field context={context} name="otRatio" />
        <Field context={context} name="esiOnOt" wide />
      </Section>

      <Section
        id={id("provident-fund")}
        title="Provident fund"
        note="PF limit and PF employee percent are used when you process salary. The other fields are recorded only."
      >
        <Field context={context} name="pfNo" />
        <Field context={context} name="pfStartDate" />
        <Plain
          context={context}
          name="pfLimit"
          label="PF limit (rupees)"
          inputMode="decimal"
          placeholder="No cap"
          defaultValue={
            company?.pfLimitPaise == null
              ? ""
              : plainRupees(company.pfLimitPaise)
          }
        />
        <Plain
          context={context}
          name="pfEmployeePercent"
          label="PF employee percent"
          inputMode="decimal"
          placeholder="Not configured"
          defaultValue={String(company?.pfEmployeePercent ?? "")}
          help="Leave blank to withhold no PF. This is not a statutory default."
        />
        <Field context={context} name="extCode" />
        <Field context={context} name="pfDiffEpfPercent" />
        <Field context={context} name="pfPensionPercent" />
        <Field context={context} name="pfAc2Percent" />
        <Field context={context} name="pfAc2MinPaise" />
        <Field context={context} name="pfAc21Percent" />
        <Field context={context} name="pfAc21MinPaise" />
        <Field context={context} name="pfAc22Percent" />
        <Field context={context} name="pfAc22MinPaise" />
        <Field context={context} name="pfGroup" />
        <Field context={context} name="pfCompanyGroup" />
        <Field context={context} name="pfOffice" wide />
        <Field context={context} name="pfCalculation" wide />
      </Section>

      <Section
        id={id("esi")}
        title="Employees' State Insurance"
        note="ESI limit and ESI employee percent are used when you process salary. The other fields are recorded only."
      >
        <Field context={context} name="esiNo" />
        <Field context={context} name="esiStartDate" />
        <Plain
          context={context}
          name="esiExceptionLimit"
          label="ESI limit (rupees)"
          inputMode="decimal"
          defaultValue={
            company ? plainRupees(company.esiExceptionLimitPaise) : ""
          }
          help="Salary above this is flagged for ESI. The reference screen flags ESI salary above 21000. The amount is configurable here."
        />
        <Field context={context} name="esiCompanyGroup" />
        <Plain
          context={context}
          name="esiEmployeePercent"
          label="ESI employee (%)"
          inputMode="decimal"
          placeholder="Not configured"
          defaultValue={String(company?.esiEmployeePercent ?? "")}
        />
        <Field context={context} name="esiEmployerPercent" />
        <Field context={context} name="localOffice" wide />
        <Field context={context} name="esiCalculation" wide />
      </Section>
    </div>
  );
}
