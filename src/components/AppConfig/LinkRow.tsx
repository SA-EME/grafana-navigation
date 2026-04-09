import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Combobox, ComboboxOption, Field, IconButton, Input } from '@grafana/ui';
import { NavLink } from '../../types';
import { ICON_OPTIONS, LINK_TYPE_OPTIONS } from '../../navigation/constants';
import type { AppConfigStyles } from './AppConfig';

export type DashboardOption = SelectableValue<string>;

const ICON_COMBOBOX_OPTIONS: Array<ComboboxOption<string>> = ICON_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.value as any,
}));

const LINK_TYPE_COMBOBOX_OPTIONS: Array<ComboboxOption<string>> = LINK_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

export interface LinkRowProps {
  link: NavLink;
  dashboardOptions: DashboardOption[];
  loadingDashboards: boolean;
  onUpdate: (patch: Partial<NavLink>) => void;
  onRemove: () => void;
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  styles: AppConfigStyles;
}

export const LinkRow = ({
  link,
  dashboardOptions,
  loadingDashboards,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  styles: s,
}: LinkRowProps) => {
  const dashboardComboboxOptions: Array<ComboboxOption<string>> = dashboardOptions.map((o) => ({
    value: o.value ?? '',
    label: o.label ?? o.value ?? '',
  }));

  return (
    <div className={s.linkRow}>
      <Field label="Icon" className={s.fieldIcon}>
        <Combobox
          options={ICON_COMBOBOX_OPTIONS}
          value={link.icon ?? null}
          placeholder="—"
          onChange={(v) => onUpdate({ icon: v?.value ?? undefined })}
          isClearable
        />
      </Field>
      <Field label="Title" className={s.fieldGrow}>
        <Input
          value={link.title}
          placeholder="Link title"
          onChange={(e) => onUpdate({ title: e.currentTarget.value })}
        />
      </Field>
      <Field label="Type" className={s.fieldFixed}>
        <Combobox
          options={LINK_TYPE_COMBOBOX_OPTIONS}
          value={link.type}
          onChange={(v) => onUpdate({ type: (v?.value as NavLink['type']) ?? 'dashboard', uid: '', url: '' })}
        />
      </Field>
      {link.type === 'dashboard' ? (
        <Field label="Dashboard" className={s.fieldGrow}>
          <Combobox
            options={dashboardComboboxOptions}
            value={link.uid ?? null}
            loading={loadingDashboards}
            placeholder="Dashboard..."
            onChange={(v) => onUpdate({ uid: v?.value ?? '' })}
            isClearable
          />
        </Field>
      ) : (
        <Field label="URL" className={s.fieldGrow}>
          <Input
            value={link.url ?? ''}
            placeholder="https://... or /"
            onChange={(e) => onUpdate({ url: e.currentTarget.value })}
          />
        </Field>
      )}
      <div className={s.removeLink}>
        {onMoveUp !== undefined && (
          <IconButton name="arrow-up" tooltip="Move up" onClick={onMoveUp ?? undefined} disabled={onMoveUp === null} />
        )}
        {onMoveDown !== undefined && (
          <IconButton name="arrow-down" tooltip="Move down" onClick={onMoveDown ?? undefined} disabled={onMoveDown === null} />
        )}
        <IconButton name="trash-alt" tooltip="Remove link" onClick={onRemove} />
      </div>
    </div>
  );
};
