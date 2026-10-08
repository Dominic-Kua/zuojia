import React, { useState } from 'react';

export function StoryMapActionDialog({
  title,
  description,
  mode = 'input',
  inputType = 'text',
  label,
  initialValue = '',
  initialDay = 0,
  initialYear = 0,
  placeholder,
  inputTestId,
  dayInputTestId = 'storymap-chronology-day-input',
  yearInputTestId = 'storymap-chronology-year-input',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue);
  const [day, setDay] = useState(String(initialDay));
  const [year, setYear] = useState(String(initialYear));

  function handleSubmit(event) {
    event.preventDefault();
    if (mode === 'chronology') {
      onConfirm({ day: Number(day), year: Number(year) });
    } else {
      onConfirm(value);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      data-testid="storymap-action-dialog-backdrop"
      onClick={onCancel}
    >
      <section
        className="storymap-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storymap-action-dialog-title"
        data-testid="storymap-action-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="storymap-action-dialog-title">{title}</h3>
        {description && <p>{description}</p>}
        {mode === 'confirm' ? (
          <div className="modal-actions">
            <button type="button" className="btn danger btn-sm" onClick={() => onConfirm()}>
              {confirmLabel}
            </button>
            <button type="button" className="btn ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'chronology' ? (
              <div className="storymap-chronology-fields">
                <label className="storymap-action-dialog-field">
                  <span>Day</span>
                  <input
                    autoFocus
                    required
                    type="number"
                    step="1"
                    value={day}
                    data-testid={dayInputTestId}
                    onChange={(event) => setDay(event.target.value)}
                  />
                </label>
                <label className="storymap-action-dialog-field">
                  <span>Year</span>
                  <input
                    required
                    type="number"
                    step="1"
                    value={year}
                    data-testid={yearInputTestId}
                    onChange={(event) => setYear(event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <label className="storymap-action-dialog-field">
                <span>{label}</span>
                <input
                  autoFocus
                  required
                  type={inputType}
                  value={value}
                  placeholder={placeholder}
                  data-testid={inputTestId}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
            )}
            <div className="modal-actions">
              <button type="submit" className="btn primary btn-sm" data-testid="storymap-action-confirm">
                {confirmLabel}
              </button>
              <button type="button" className="btn ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
