import { requestWidgetUpdate } from 'react-native-android-widget';

import { PINNED, renderFor, SINGLE } from './render';

// Redraw every Daftar widget on the home screen (after edits, sync, or leaving the app)
export async function refreshWidgets() {
  console.log('[widget] refreshing');
  for (const widgetName of [PINNED, SINGLE]) {
    await requestWidgetUpdate({ widgetName, renderWidget: (info) => renderFor(info) }).catch((e) => console.warn(`[widget] ${widgetName} redraw failed`, e));
  }
}
