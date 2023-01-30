import { prepareExampleScalar } from './prepare-input-scalar';

describe('prepareExampleScalar', () => {
  describe('example is undefined', () => {
    it('returns undefined', () => {
      expect(prepareExampleScalar('input', undefined)).toBeUndefined();
    });
  });

  describe('example is scalar', () => {
    it('returns passed place', () => {
      expect(
        prepareExampleScalar('input', { kind: 'boolean', value: true })
      ).toEqual('input');
      expect(
        prepareExampleScalar('error', { kind: 'number', value: 12 })
      ).toEqual('error');
      expect(
        prepareExampleScalar('result', { kind: 'string', value: 'foo' })
      ).toEqual('result');
    });
  });

  describe('example is array', () => {
    it('returns passed place when array is empty', () => {
      expect(
        prepareExampleScalar('input', { kind: 'array', items: [] })
      ).toEqual('input');
    });

    it('returns path to scalar item', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'array',
          items: [{ kind: 'string', value: 'foo' }],
        })
      ).toEqual('input[0]');
    });

    it('returns path to empty object item', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'array',
          items: [{ kind: 'object', properties: [] }],
        })
      ).toEqual('input[0]');
    });

    it('returns path to object item', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'array',
          items: [
            {
              kind: 'object',
              properties: [{ kind: 'number', value: 1, name: 'foo' }],
            },
          ],
        })
      ).toEqual('input[0].foo');
    });

    it('returns path to empty array item', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'array',
          items: [{ kind: 'array', items: [] }],
        })
      ).toEqual('input[0]');
    });

    it('returns path to array item', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'array',
          items: [{ kind: 'array', items: [{ kind: 'number', value: 1 }] }],
        })
      ).toEqual('input[0][0]');
    });
  });

  describe('example is object', () => {
    it('returns passed place when object is empty', () => {
      expect(
        prepareExampleScalar('input', { kind: 'object', properties: [] })
      ).toEqual('input');
    });

    it('returns path to scalar property', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'object',
          properties: [{ kind: 'string', value: 'foo', name: 'foo' }],
        })
      ).toEqual('input.foo');
    });

    it('returns path to empty object property', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'object',
          properties: [{ kind: 'object', properties: [], name: 'foo' }],
        })
      ).toEqual('input.foo');
    });

    it('returns path to object property', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'object',
          properties: [
            {
              kind: 'object',
              name: 'foo',
              properties: [{ kind: 'number', value: 1, name: 'bar' }],
            },
          ],
        })
      ).toEqual('input.foo.bar');
    });

    it('returns path to empty array property', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'object',
          properties: [{ kind: 'array', name: 'foo', items: [] }],
        })
      ).toEqual('input.foo');
    });

    it('returns path to array property', () => {
      expect(
        prepareExampleScalar('input', {
          kind: 'object',
          properties: [
            {
              kind: 'array',
              name: 'foo',
              items: [{ kind: 'number', value: 1 }],
            },
          ],
        })
      ).toEqual('input.foo[0]');
    });
  });
});
