import { describe, it, expect } from 'vitest';
import { toggleNthTask, toggleTaskAtLine, getTaskLineNumbers } from '~/lib/utils/markdownTasks';

describe('markdownTasks.toggleNthTask', () => {
  it('toggles only the targeted item in a flat list', () => {
    const md = [
      '- [ ] A',
      '- [x] B',
      '- [ ] C',
    ].join('\n');
    // task indices: A=0, B=1, C=2
    const next = toggleNthTask(md, 1);
    expect(next.split('\n')).toEqual(['- [ ] A', '- [ ] B', '- [ ] C']);
  });

  it('does not affect items above or below in nested/mixed lists', () => {
    const md = [
      '- [ ] Top 1',
      '  - [ ] Sub 1',
      '  - [x] Sub 2',
      '- [ ] Top 2',
    ].join('\n');
    // task indices over all tasks: Top1=0, Sub1=1, Sub2=2, Top2=3
    const next = toggleNthTask(md, 2); // flip Sub2 only
    expect(next.split('\n')).toEqual([
      '- [ ] Top 1',
      '  - [ ] Sub 1',
      '  - [ ] Sub 2',
      '- [ ] Top 2',
    ]);
  });

  it('toggling an upper checked item does not change a lower unchecked item', () => {
    const md = [
      '- [x] Top 1',
      '- [ ] Top 2',
    ].join('\n');
    // indices: Top1=0, Top2=1
    const next = toggleNthTask(md, 0); // flip Top1 to unchecked
    expect(next.split('\n')).toEqual(['- [ ] Top 1', '- [ ] Top 2']);
  });

  it('toggling an upper checked item does not change a lower checked item except itself when indices shift', () => {
    const md = [
      '- [x] A',
      '- [x] B',
      '- [ ] C',
    ].join('\n');
    // indices: A=0, B=1, C=2 ; toggle A only
    const next = toggleNthTask(md, 0);
    expect(next.split('\n')).toEqual(['- [ ] A', '- [x] B', '- [ ] C']);
  });
});
describe('markdownTasks.getTaskLineNumbers', () => {
  it('maps render order to source lines', () => {
    const md = [
      'Intro',
      '- [ ] A',
      '  * not a task',
      '- [x] B',
      'text',
      '   - [ ] C',
    ].join('\n');
    expect(getTaskLineNumbers(md)).toEqual([2, 4, 6]);
  });
});

describe('markdownTasks.toggleTaskAtLine', () => {
  it('toggles only the target line (1-based)', () => {
    const md = [
      '- [x] A',
      '- [ ] B',
      '- [x] C',
    ].join('\n');
    const next = toggleTaskAtLine(md, 2); // toggle B only
    expect(next.split('\n')).toEqual(['- [x] A', '- [x] B', '- [x] C']);
  });

  it('does nothing when the target line is not a task', () => {
    const md = [
      '# Title',
      'Paragraph',
      '- [ ] Task',
    ].join('\n');
    const next = toggleTaskAtLine(md, 2);
    expect(next).toEqual(md);
  });
});


