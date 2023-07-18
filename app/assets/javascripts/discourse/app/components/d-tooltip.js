import Component from "@ember/component";
import { schedule } from "@ember/runloop";
import { iconHTML } from "discourse-common/lib/icon-library";
import tippy from "tippy.js";
import Ember from "ember";

export default class DiscourseTooltip extends Component {
  tagName = "";
  interactive = false;
  placement = this.args?.placement || "bottom-start";

  didInsertElement() {
    this._super(...arguments);
    this._initTippy();
  }

  willDestroyElement() {
    this._super(...arguments);
    this._tippyInstance.destroy();
  }

  stopPropagation(instance, event) {
    event.preventDefault();
    event.stopPropagation();
  }

  _initTippy() {
    schedule("afterRender", () => {
      // Ember.ViewUtils.getViewBounds is a private API,
      // but it's not going to be dropped without a public deprecation warning,
      // see: https://stackoverflow.com/a/50125938/3206146
      const viewBounds = Ember.ViewUtils.getViewBounds(this);
      const element = viewBounds.firstNode;
      const parent = viewBounds.parentElement;
      const interactive = this.interactive;
      this._tippyInstance = tippy(parent, {
        interactive,
        content: element,
        trigger: this.capabilities.touch ? "click" : "mouseenter",
        theme: this.attrs.theme || "d-tooltip",
        arrow: this.attrs.arrow ? iconHTML("tippy-rounded-arrow") : false,
        placement: this.placement,
        onTrigger: this.stopPropagation,
        onUntrigger: this.stopPropagation,
      });
    });
  }
}
