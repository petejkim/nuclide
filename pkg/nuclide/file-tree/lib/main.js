'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {CompositeDisposable} = require('atom');

import type {Disposable} from 'atom';

import type FileTreeControllerType from './FileTreeController';
import type {FileTreeControllerState} from './FileTreeController';

/**
 * Minimum interval (in ms) between onChangeActivePaneItem events before revealing the active pane
 * item in the file tree.
 */
const ACTIVE_PANE_DEBOUNCE_INTERVAL_MS = 150;

// Unload 'tree-view' so we can control whether it is activated or not.
//
// Running the code in the global scope here ensures that it's called before 'tree-view' is
// activated. This allows us to unload it before it's activated, ensuring it has minimal impact on
// startup time.
var loadSubscription = atom.packages.onDidLoadInitialPackages(() => {
  if (atom.packages.isPackageLoaded('tree-view')) {
    atom.packages.unloadPackage('tree-view');
  }

  if (loadSubscription) {
    loadSubscription.dispose();
    loadSubscription = null;
  }
});

class Activation {
  _fileTreeController: ?FileTreeControllerType;
  _packageState: ?FileTreeControllerState;
  _subscriptions: CompositeDisposable;
  _paneItemSubscription: ?Disposable;

  constructor(state: ?FileTreeControllerState) {
    this._packageState = state;
    this._subscriptions = new CompositeDisposable();

    var FileTreeController = require('./FileTreeController');
    this._fileTreeController = new FileTreeController(this._packageState);

    const revealSetting = 'nuclide-file-tree.revealFileOnSwitch';
    // Flow does not know that this setting is a boolean, thus the cast.
    this._setRevealOnFileSwitch(((atom.config.get(revealSetting): any): boolean));
    this._subscriptions.add(
      atom.config.observe(revealSetting, this._setRevealOnFileSwitch.bind(this))
    );

    require('nuclide-analytics').track('filetreedeux-enable');
  }

  dispose() {
    this._deactivate();
    this._subscriptions.dispose();
  }

  serialize(): ?FileTreeControllerState {
    if (this._fileTreeController) {
      return this._fileTreeController.serialize();
    }
  }

  _setRevealOnFileSwitch(shouldReveal: boolean) {
    var {onWorkspaceDidStopChangingActivePaneItem} =
      require('nuclide-atom-helpers').atomEventDebounce;

    if (shouldReveal) {
      const reveal = () => {
        if (this._fileTreeController) {
          this._fileTreeController.revealActiveFile(/* showIfHidden */ false);
        }
      };
      // Guard against this getting called multiple times
      if (!this._paneItemSubscription) {
        // Debounce tab change events to limit unneeded scrolling when changing or closing tabs
        // in quick succession.
        this._paneItemSubscription = onWorkspaceDidStopChangingActivePaneItem(
          reveal,
          ACTIVE_PANE_DEBOUNCE_INTERVAL_MS
        );
        this._subscriptions.add(this._paneItemSubscription);
      }
    } else {
      // Use a local so Flow can refine the type.
      const paneItemSubscription = this._paneItemSubscription;
      if (paneItemSubscription) {
        this._subscriptions.remove(paneItemSubscription);
        paneItemSubscription.dispose();
        this._paneItemSubscription = null;
      }
    }
  }

  _deactivate() {
    // Guard against deactivate being called twice
    if (this._fileTreeController) {
      this._fileTreeController.destroy();
      this._fileTreeController = null;
    }
  }
}

var activation: ?Activation = null;

module.exports = {
  config: {
    revealFileOnSwitch: {
      type: 'boolean',
      default: false,
      description: 'Automatically reveal the current file when you switch tabs',
    },
  },

  activate(state: ?FileTreeControllerState): void {
    // We need to check if the package is already disabled, otherwise Atom will add it to the
    // 'core.disabledPackages' config multiple times.
    if (!atom.packages.isPackageDisabled('tree-view')) {
      atom.packages.disablePackage('tree-view');
    }

    if (!activation) {
      activation = new Activation(state);
    }
  },

  deactivate() {
    if (activation) {
      activation.dispose();
      activation = null;
    }

    // The user most likely wants either `nuclide-file-tree` or `tree-view` at any given point. If
    // `nuclide-file-tree` is disabled, we should re-enable `tree-view` so they can still browse
    // files.
    //
    // `deactivate` is called on all packages when a window is torn down. It's also called when a
    // user clicks "Disable" in the settings view. For the latter, `isPackageDisabled` will be
    // `true`, and so it is checked here to differentiate.
    //
    // @see t8570656
    if (atom.packages.isPackageDisabled('nuclide-file-tree')) {
      atom.packages.enablePackage('tree-view');
    }
  },

  serialize(): ?FileTreeControllerState {
    if (activation) {
      return activation.serialize();
    }
  },
};
