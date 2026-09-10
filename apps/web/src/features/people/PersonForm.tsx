import { useState, type FormEvent } from 'react';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import type { PersonInput } from '../../lib/api';
import { errorMessage } from '../../lib/api';
import {
  emptyPersonForm,
  personToForm,
  validatePersonForm,
  type PersonFormValues,
} from './person-form';

interface PersonFormProps {
  graph: FamilyGraph;
  person?: Person;
  onSave: (input: PersonInput) => Promise<Person>;
  onSaved: (person: Person) => void;
  onCancel?: () => void;
}

export function PersonForm({ graph, person, onSave, onSaved, onCancel }: PersonFormProps) {
  const [values, setValues] = useState<PersonFormValues>(() => person ? personToForm(person) : emptyPersonForm());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PersonFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof PersonFormValues>(field: K, value: PersonFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePersonForm(values, graph, new Date().getUTCFullYear(), person?.id);
    setFieldErrors(validation.fieldErrors);
    setFormError(validation.formError ?? null);
    if (!validation.input || Object.keys(validation.fieldErrors).length || validation.formError) return;

    setSaving(true);
    try {
      const saved = await onSave(validation.input);
      onSaved(saved);
      if (!person) setValues(emptyPersonForm());
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="person-form" onSubmit={submit} noValidate>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{person ? 'Person details' : 'New relative'}</span>
          <h2>{person ? `Edit ${person.firstName}` : graph.people.length ? 'Add a person' : 'Add the first person'}</h2>
        </div>
        {onCancel && <button className="button button--quiet" type="button" onClick={onCancel}>Cancel</button>}
      </div>

      {formError && <div className="alert alert--error" role="alert">{formError}</div>}

      <fieldset className="form-section">
        <legend>Identity</legend>
        <div className="form-grid form-grid--two">
          <Field label="First name" error={fieldErrors.firstName}>
            <input value={values.firstName} onChange={(event) => update('firstName', event.target.value)} required />
          </Field>
          <Field label="Last name" error={fieldErrors.lastName}>
            <input value={values.lastName} onChange={(event) => update('lastName', event.target.value)} required />
          </Field>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={values.adopted} onChange={(event) => update('adopted', event.target.checked)} />
          <span><strong>Adopted</strong><small>Shown as positive person information, without changing family connections.</small></span>
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>Life information</legend>
        <div className="form-grid form-grid--three">
          <Field label="Life status">
            <select value={values.lifeStatus} onChange={(event) => {
              const status = event.target.value as PersonFormValues['lifeStatus'];
              update('lifeStatus', status);
              if (status === 'living') update('deathYear', '');
            }}>
              <option value="unknown">Unknown</option>
              <option value="living">Living</option>
              <option value="deceased">Deceased</option>
            </select>
          </Field>
          <Field label="Birth year" hint="Leave blank if unknown" error={fieldErrors.birthYear}>
            <input inputMode="numeric" placeholder="e.g. 1952" value={values.birthYear} onChange={(event) => update('birthYear', event.target.value)} />
          </Field>
          <Field label="Death year" hint={values.lifeStatus === 'living' ? 'Not applicable when living' : 'Leave blank if unknown'} error={fieldErrors.deathYear}>
            <input
              inputMode="numeric"
              placeholder="e.g. 2019"
              value={values.deathYear}
              onChange={(event) => update('deathYear', event.target.value)}
              disabled={values.lifeStatus === 'living'}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Memorable details</legend>
        <p className="section-copy">Add up to three short facts. Empty facts are not saved.</p>
        <div className="facts-grid">
          {values.funFacts.map((fact, index) => (
            <label key={index}>
              Fact {index + 1}
              <input
                value={fact}
                maxLength={180}
                placeholder={index === 0 ? 'Owned a bakery in Lyon' : 'Add another memory'}
                onChange={(event) => {
                  const facts = [...values.funFacts] as PersonFormValues['funFacts'];
                  facts[index] = event.target.value;
                  update('funFacts', facts);
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>What is known?</legend>
        <p className="section-copy">Mark a list complete only when the family knows there are no other connections. An empty complete list means “none”; unchecked means “unknown or incomplete.”</p>
        <div className="completeness-grid">
          <CompletenessToggle label="All parents are known" checked={values.parentsComplete} onChange={(checked) => update('parentsComplete', checked)} />
          <CompletenessToggle label="All partners are known" checked={values.partnersComplete} onChange={(checked) => update('partnersComplete', checked)} />
          <CompletenessToggle label="All children are known" checked={values.childrenComplete} onChange={(checked) => update('childrenComplete', checked)} />
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : person ? 'Save changes' : 'Add person'}
        </button>
        <span className="save-hint">Changes become part of the authoritative family graph.</span>
      </div>
    </form>
  );
}

function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function CompletenessToggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-card">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><strong>{label}</strong><small>{checked ? 'Known complete' : 'Still unknown or incomplete'}</small></span>
    </label>
  );
}
