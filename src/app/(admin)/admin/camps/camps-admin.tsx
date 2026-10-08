"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { patchJson, postJson, type ApiResult } from "@/lib/api-client";
import {
  CAMP_DESCRIPTION_MAX,
  CAMP_LOCATION_MAX,
  CAMP_NAME_MAX,
  DONATION_CATEGORY_MAX,
  DONATION_INSTRUCTIONS_MAX,
} from "@/lib/camps/constants";
import type { CampItem } from "@/lib/validation/camps";
import { ParticipantsPanel } from "./participants-panel";

const CAMPS_KEY = ["camps"] as const;
const KNOWN_ERRORS = [
  "fee_authorization_required",
  "end_before_start",
  "deadline_after_end",
] as const;
const TEXTAREA =
  "w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text focus:outline-2 focus:outline-offset-1 focus:outline-primary";

async function fetchCamps(): Promise<CampItem[]> {
  const response = await fetch("/api/camps", { cache: "no-store" });
  if (!response.ok) throw new Error(`camps ${response.status}`);
  return response.json();
}

function formatDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type FormState = {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  open: boolean;
  quotaYouthMale: string;
  quotaYouthFemale: string;
  feeYouth: string;
  feeLeader: string;
  feeAuthorized: boolean;
  donationCategoryName: string;
  donationInstructions: string;
};

function toForm(camp: CampItem | null): FormState {
  return {
    name: camp?.name ?? "",
    description: camp?.description ?? "",
    location: camp?.location ?? "",
    startDate: camp?.startDate ?? "",
    endDate: camp?.endDate ?? "",
    registrationDeadline: camp?.registrationDeadline ?? "",
    open: camp?.open ?? false,
    quotaYouthMale: String(camp?.quotaYouthMale ?? 0),
    quotaYouthFemale: String(camp?.quotaYouthFemale ?? 0),
    feeYouth: camp?.feeYouth ?? "0",
    feeLeader: camp?.feeLeader ?? "0",
    feeAuthorized: camp?.feeAuthorized ?? false,
    donationCategoryName: camp?.donationCategoryName ?? "",
    donationInstructions: camp?.donationInstructions ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    registrationDeadline: form.registrationDeadline,
    open: form.open,
    quotaYouthMale: Number(form.quotaYouthMale) || 0,
    quotaYouthFemale: Number(form.quotaYouthFemale) || 0,
    feeYouth: Number(form.feeYouth) || 0,
    feeLeader: Number(form.feeLeader) || 0,
    feeAuthorized: form.feeAuthorized,
    donationCategoryName: form.donationCategoryName.trim(),
    donationInstructions: form.donationInstructions.trim(),
  };
}

export function CampsAdmin({
  initialCamps,
  canCreate,
  canUpdate,
}: {
  initialCamps: CampItem[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const t = useTranslations("camps");
  const { data: camps = initialCamps } = useQuery({
    queryKey: CAMPS_KEY,
    queryFn: fetchCamps,
    initialData: initialCamps,
  });
  const [editing, setEditing] = useState<{ camp: CampItem | null } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => camps.find((camp) => camp.id === selectedId) ?? camps[0] ?? null,
    [camps, selectedId],
  );

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-text">{t("title")}</h1>
          <p className="text-sm text-text-muted">{t("intro")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setEditing({ camp: null })}>
            {t("newCamp")}
          </Button>
        )}
      </div>

      {camps.length === 0 ? (
        <p className="text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {camps.map((camp) => (
            <CampCard
              key={camp.id}
              camp={camp}
              selected={selected?.id === camp.id}
              canUpdate={canUpdate}
              onSelect={() => setSelectedId(camp.id)}
              onEdit={() => setEditing({ camp })}
            />
          ))}
        </ul>
      )}

      {selected && (
        <section
          className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
          aria-labelledby="camp-participants-title"
        >
          <h2
            id="camp-participants-title"
            className="text-xl font-semibold text-text"
          >
            {t("participantsOf", { camp: selected.name })}
          </h2>
          <ParticipantsPanel
            key={selected.id}
            camp={selected}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </section>
      )}

      {editing && (
        <CampModal
          camp={editing.camp}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function CampCard({
  camp,
  selected,
  canUpdate,
  onSelect,
  onEdit,
}: {
  camp: CampItem;
  selected: boolean;
  canUpdate: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("camps");
  const locale = useLocale();
  return (
    <li
      className={`flex flex-col gap-2 rounded-md border bg-surface p-4 shadow-sm ${selected ? "border-primary" : "border-border"}`}
      data-testid="camp-card"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex flex-col gap-2 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-text">{camp.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${camp.open ? "bg-success-surface text-success-strong" : "bg-surface-muted text-text-muted"}`}
          >
            {camp.open ? t("badges.open") : t("badges.closed")}
          </span>
        </span>
        <span className="text-sm text-text-muted">
          {t("dates", {
            start: formatDate(camp.startDate, locale),
            end: formatDate(camp.endDate, locale),
          })}{" "}
          · {camp.location}
        </span>
        <span className="text-sm text-text-muted">
          {t("deadline", {
            date: formatDate(camp.registrationDeadline, locale),
          })}
        </span>
        <span className="flex flex-wrap gap-4 text-sm text-text-muted">
          <span>{t("counts.youth", { n: camp.youthCount })}</span>
          <span>{t("counts.leaders", { n: camp.leaderCount })}</span>
          <span>{t("counts.approved", { n: camp.approvedCount })}</span>
          <span>{t("counts.pending", { n: camp.pendingCount })}</span>
        </span>
      </button>
      {camp.feeAuthorized && camp.feeAuthorizedAt && (
        <span className="text-sm text-text-muted">
          {t("feeAuthorizedBy", {
            name: camp.feeAuthorizedByName ?? "—",
            date: new Date(camp.feeAuthorizedAt).toLocaleDateString(locale),
          })}
        </span>
      )}
      <a
        href={`/camps/${camp.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium break-all text-primary underline-offset-4 hover:text-primary-strong hover:underline"
      >
        {t("publicLink", { slug: camp.slug })}
      </a>
      {canUpdate && (
        <Button variant="link" className="self-start" onClick={onEdit}>
          {t("editCamp")}
        </Button>
      )}
    </li>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-text">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function CampModal({
  camp,
  onClose,
  onSaved,
}: {
  camp: CampItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("camps");
  const tErrors = useTranslations("errors");
  const queryClient = useQueryClient();
  const titleId = useId();
  const descriptionId = useId();
  const instructionsId = useId();
  const [form, setForm] = useState<FormState>(() => toForm(camp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const asksForFee =
    (Number(form.feeYouth) || 0) > 0 || (Number(form.feeLeader) || 0) > 0;

  function messageFor(result: Extract<ApiResult<unknown>, { ok: false }>) {
    const code = KNOWN_ERRORS.find((known) =>
      result.issues.some((issue) => issue.code === known),
    );
    if (code) return t(`errors.${code}`);
    if (result.error === "invalid_input") return t("errors.fields");
    return tErrors(result.error);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = toPayload(form);
    const result = camp
      ? await patchJson<CampItem>(`/api/camps/${camp.id}`, payload)
      : await postJson<CampItem>("/api/camps", payload);
    setSaving(false);
    if (!result.ok) {
      setError(messageFor(result));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: CAMPS_KEY });
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <form
        noValidate
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-lg"
      >
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {t(camp ? "modal.editTitle" : "modal.createTitle")}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger" role="alert" title={error} />}
            <Field
              label={t("modal.name")}
              value={form.name}
              maxLength={CAMP_NAME_MAX}
              onChange={(event) => set("name", event.target.value)}
              required
            />
            <Field
              label={t("modal.location")}
              value={form.location}
              maxLength={CAMP_LOCATION_MAX}
              onChange={(event) => set("location", event.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={descriptionId}
                className="text-sm font-medium text-text-muted"
              >
                {t("modal.description")}
              </label>
              <textarea
                id={descriptionId}
                className={TEXTAREA}
                rows={3}
                maxLength={CAMP_DESCRIPTION_MAX}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                type="date"
                label={t("modal.startDate")}
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
                required
              />
              <Field
                type="date"
                label={t("modal.endDate")}
                value={form.endDate}
                onChange={(event) => set("endDate", event.target.value)}
                required
              />
              <Field
                type="date"
                label={t("modal.registrationDeadline")}
                value={form.registrationDeadline}
                onChange={(event) =>
                  set("registrationDeadline", event.target.value)
                }
                required
              />
            </div>
            <Checkbox
              checked={form.open}
              onChange={(value) => set("open", value)}
            >
              {t("modal.open")}
            </Checkbox>
            <p className="text-sm text-text-muted">{t("modal.openHelp")}</p>

            <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium text-text-muted">
                {t("modal.quotasLegend")}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  label={t("modal.quotaYouthMale")}
                  value={form.quotaYouthMale}
                  onChange={(event) =>
                    set("quotaYouthMale", event.target.value)
                  }
                />
                <Field
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  label={t("modal.quotaYouthFemale")}
                  value={form.quotaYouthFemale}
                  onChange={(event) =>
                    set("quotaYouthFemale", event.target.value)
                  }
                />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium text-text-muted">
                {t("modal.feesLegend")}
              </legend>
              <p className="text-sm text-text-muted">{t("modal.feesHelp")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  label={t("modal.feeYouth")}
                  value={form.feeYouth}
                  onChange={(event) => set("feeYouth", event.target.value)}
                />
                <Field
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  label={t("modal.feeLeader")}
                  value={form.feeLeader}
                  onChange={(event) => set("feeLeader", event.target.value)}
                />
              </div>
              {(asksForFee || form.feeAuthorized) && (
                <>
                  <Checkbox
                    checked={form.feeAuthorized}
                    onChange={(value) => set("feeAuthorized", value)}
                  >
                    {t("modal.feeAuthorized")}
                  </Checkbox>
                  <Field
                    label={t("modal.donationCategoryName")}
                    value={form.donationCategoryName}
                    maxLength={DONATION_CATEGORY_MAX}
                    onChange={(event) =>
                      set("donationCategoryName", event.target.value)
                    }
                  />
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={instructionsId}
                      className="text-sm font-medium text-text-muted"
                    >
                      {t("modal.donationInstructions")}
                    </label>
                    <textarea
                      id={instructionsId}
                      className={TEXTAREA}
                      rows={3}
                      maxLength={DONATION_INSTRUCTIONS_MAX}
                      value={form.donationInstructions}
                      onChange={(event) =>
                        set("donationInstructions", event.target.value)
                      }
                    />
                  </div>
                </>
              )}
              <p className="text-sm text-text-muted">{t("modal.noMoney")}</p>
            </fieldset>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {t(camp ? "modal.save" : "modal.create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
