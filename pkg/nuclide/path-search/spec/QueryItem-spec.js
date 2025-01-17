'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import invariant from 'assert';
import QueryItem from '../lib/QueryItem';

describe('QueryItem', () => {
  describe('"Hello"', () => {
    const item = new QueryItem('Hello');

    it('should return a score of 1 on no query', () => {
      const score = item.score('');
      invariant(score);
      expect(score.score).toBe(1);
      expect(score.matchIndexes).toEqual([]);
    });

    it('should return null on no match', () => {
      expect(item.score('z')).toBe(null);
    });

    it('should return null on non-sequential matches', () => {
      expect(item.score('lh')).toBe(null);
    });

    it('should ignore query case', () => {
      const score1 = item.score('He');
      const score2 = item.score('he');
      invariant(score1);
      invariant(score2);
      expect(score1.score).toEqual(score2.score);
    });

    it('should prefer matches where the letters are closer together', () => {
      const score1 = item.score('he');
      const score2 = item.score('hl');
      const score3 = item.score('ho');
      invariant(score1);
      invariant(score2);
      invariant(score3);
      expect(score1.score).toBeGreaterThan(score2.score);
      expect(score2.score).toBeGreaterThan(score3.score);
    });
  });

  describe('Path Separator', () => {
    const item = new QueryItem('He/y/Hello', '/');

    it('should prefer matches after the last path separator', () => {
      const score = item.score('h');
      invariant(score);
      expect(score.matchIndexes).toEqual([5]);
    });

    it('should return null if no matches appeared after the last path separator', () => {
      expect(item.score('hey')).toBe(null);
    });

    it('should still be able to match characters before the separator', () => {
      expect(item.score('heyh')).not.toBe(null);
    });
  });

  describe('Misc', () => {
    it('should prefer matches with an initialism', () => {
      const item = new QueryItem('AbBa');
      const score = item.score('ab');
      invariant(score);
      expect(score.matchIndexes).toEqual([0, 2]);
    });

    it('should be able to fall back to substring match when an initialism skip fails', () => {
      const item = new QueryItem('AbBa');

      // If the query could initially trigger a skip then fail, still treturn a result.
      expect(item.score('bb')).not.toBe(null);
    });
  });

});
