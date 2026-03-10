import * as api from '../index';

describe('public API boundary', () => {
  it('does not expose BaseObject in the public surface', () => {
    expect(api).not.toHaveProperty('BaseObject');
  });

  it('keeps Shape available as the general-purpose public object', () => {
    expect(api).toHaveProperty('Shape');
  });

  it('exposes frame for definition-time reusable graph components', () => {
    expect(api).toHaveProperty('frame');
  });

  it('exposes MindMapEmbed for reusable mind map subtrees', () => {
    expect(api).toHaveProperty('MindMapEmbed');
  });
});
