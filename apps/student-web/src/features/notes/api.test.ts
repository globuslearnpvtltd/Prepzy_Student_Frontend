import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { notesApi, toChapterNotes, toTopics, toVideoUrl } from './api';
import { prepareNotes } from './document';

describe('notes mapping', () => {
  it('keeps malformed JSON as text and treats "null" strings as empty', () => {
    expect(toTopics('[broken')).toEqual([]);
    expect(toVideoUrl('{oops')).toBe('{oops');
    expect(toVideoUrl(' undefined ')).toBeNull();
    expect(toVideoUrl('[{"link":""},{"link":"https://v.test/2.mp4"}]')).toBe('https://v.test/2.mp4');
    expect(toChapterNotes({ notes_text: 5, student_note_active: true, student_video_active: '1' })).toMatchObject({
      noteId: '',
      html: '',
      notesReady: true,
      videoReady: true,
      moduleOrder: 0,
    });
  });
});

describe('notesApi requests', () => {
  it('maps a course’s notes', async () => {
    server.use(
      http.get(`${API}/api/v4/notes/courses/5`, () =>
        HttpResponse.json({ success: true, data: { notes: [{ note_id: 1, module_id: 2, module_name: 'Light', notes_index_ref: [] }] } }),
      ),
      http.get(`${API}/api/v4/notes/courses/6`, () => HttpResponse.json({ success: true, data: {} })),
    );
    expect(await notesApi.courseNotes('5')).toEqual([expect.objectContaining({ noteId: '1', moduleId: '2', moduleName: 'Light', topics: [] })]);
    expect(await notesApi.courseNotes('6')).toEqual([]);
  });

  it('falls back to the requested note id and parses JSON narrations', async () => {
    server.use(
      http.get(`${API}/api/v4/notes/summary-video/9`, () =>
        HttpResponse.json({ success: true, data: { narrations: '["One"," ",2]', video_link: '[{"language":"hi","link":"https://v.test/h.mp4"}]' } }),
      ),
      http.get(`${API}/api/v4/notes/summary-video/10`, () => HttpResponse.json({ success: true })),
    );
    expect(await notesApi.summaryVideo('9')).toMatchObject({ noteId: '9', narrations: ['One'], videoUrl: 'https://v.test/h.mp4' });
    expect(await notesApi.summaryVideo('10')).toMatchObject({ noteId: '10', narrations: [], videoUrl: null, moduleName: '' });
  });
});

describe('prepareNotes', () => {
  it('returns nothing for empty notes', () => {
    expect(prepareNotes('', [])).toEqual({ html: '', sections: [], css: '', fonts: [] });
  });

  it('matches index entries by title, ignoring numbering, and by title prefix', () => {
    const doc = prepareNotes('<h2>2.1 Electric Field</h2><h2>Coulomb’s law and its uses</h2><h3>Unrelated</h3>', [
      { anchorId: 'missing', topic: 'Electric field' },
      { anchorId: 'gone', topic: 'Coulomb’s law' },
      { anchorId: 'nowhere', topic: 'Not in the notes' },
      { anchorId: 'x', topic: '!!' },
    ]);
    expect(doc.sections).toEqual([
      { id: 'notes-missing', title: 'Electric field' },
      { id: 'notes-gone', title: 'Coulomb’s law' },
    ]);
    expect(doc.html).toContain('id="notes-missing"');
  });

  it('lists an element once and gives clashing ids a number', () => {
    const doc = prepareNotes('<p id="notes-a">taken</p><h2>A</h2>', [
      { anchorId: 'a', topic: 'A' },
      { anchorId: 'b', topic: 'A' },
    ]);
    expect(doc.sections).toEqual([{ id: 'notes-a-2', title: 'A' }]);
  });

  it('falls back to the notes’ own headings and wraps tables once', () => {
    const doc = prepareNotes('<h1>Only</h1><h3>One</h3><h3>Two</h3><table><tr><td>1</td></tr></table>', []);
    expect(doc.sections.map((s) => s.title)).toEqual(['One', 'Two']);
    expect(doc.html).toContain('<div class="table-scroll"><table>');
    expect(prepareNotes('<p>No headings</p>', []).sections).toEqual([]);
  });
});
