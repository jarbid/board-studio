import type { MenuItem } from '@openshaper/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, commandsFromMenus, type Command } from './CommandPalette';

describe('commandsFromMenus', () => {
  it('flattens actions and checkboxes, skipping labels and separators', () => {
    const open = vi.fn();
    const grid = vi.fn();
    const menus: [string, MenuItem[]][] = [
      [
        'File',
        [
          { kind: 'label', label: 'New' },
          { kind: 'action', label: 'Open…', onSelect: open, shortcut: 'Ctrl O' },
          { kind: 'separator' },
          { kind: 'action', label: 'Save', onSelect: vi.fn(), disabled: true },
        ],
      ],
      ['View', [{ kind: 'checkbox', label: 'Grid & guides', checked: false, onSelect: grid }]],
    ];

    const commands = commandsFromMenus(menus);

    expect(commands.map((c) => c.id)).toEqual(['File/Open…', 'File/Save', 'View/Grid & guides']);
    expect(commands[0]).toMatchObject({ label: 'File: Open…', shortcut: 'Ctrl O' });
    expect(commands[1]!.disabled).toBe(true);
    commands[2]!.run();
    expect(grid).toHaveBeenCalledOnce();
  });
});

const cmds = (overrides: Partial<Command>[] = []): Command[] => [
  { id: 'f/open', label: 'File: Open…', run: vi.fn() },
  { id: 'f/save', label: 'File: Save', run: vi.fn() },
  { id: 'v/grid', label: 'View: Grid & guides', run: vi.fn() },
  ...overrides.map((o, i) => ({ id: `x/${i}`, label: `Extra ${i}`, run: vi.fn(), ...o })),
];

describe('<CommandPalette />', () => {
  it('lists enabled commands and filters as you type', () => {
    const commands = cmds([{ label: 'Hidden', disabled: true }]);
    render(<CommandPalette commands={commands} onClose={() => {}} />);

    expect(screen.getByText('File: Open…')).toBeTruthy();
    expect(screen.queryByText('Hidden')).toBeNull(); // disabled commands are not offered

    fireEvent.change(screen.getByPlaceholderText(/command/i), { target: { value: 'grid' } });
    expect(screen.getByText('View: Grid & guides')).toBeTruthy();
    expect(screen.queryByText('File: Open…')).toBeNull();
  });

  it('Enter runs the highlighted command and closes', () => {
    const commands = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/command/i);

    fireEvent.change(input, { target: { value: 'save' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(commands[1]!.run).toHaveBeenCalledOnce();
    expect(commands[0]!.run).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('arrow keys move the highlight before Enter', () => {
    const commands = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/command/i);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(commands[1]!.run).toHaveBeenCalledOnce();
  });

  it('Escape closes without running anything', () => {
    const commands = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/command/i), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
    for (const c of commands) expect(c.run).not.toHaveBeenCalled();
  });
});
