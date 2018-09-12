/* tslint:disable:max-line-length */
const tests = [
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/main.js', expectedResult: 'C:\\projectpath\\app\\main.js', existingPath: 'C:\\projectpath\\app\\main.js' },
    { platform: 'android', scriptUrl: 'VM1', expectedResult: 'VM1' },
    { platform: 'android', scriptUrl: 'native prologue.js', expectedResult: 'native prologue.js' },
    { platform: 'android', scriptUrl: 'v8/gc', expectedResult: 'v8/gc' },
    { platform: 'android', scriptUrl: 'VM25', expectedResult: 'VM25' },
    { platform: 'android', scriptUrl: '/data/data/org.nativescript.TabNavigation/files/internal/ts_helpers.js', expectedResult: '/data/data/org.nativescript.TabNavigation/files/internal/ts_helpers.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/nativescript-angular/platform.js', expectedResult: 'C:\\projectpath\\node_modules\\nativescript-angular\\platform.js', existingPath: 'C:\\projectpath\\node_modules\\nativescript-angular\\platform.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/nativescript-angular/platform-common.js', expectedResult: 'C:\\projectpath\\node_modules\\nativescript-angular\\platform-common.js', existingPath: 'C:\\projectpath\\node_modules\\nativescript-angular\\platform-common.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/@angular/common/bundles/common.umd.js', expectedResult: 'C:\\projectpath\\node_modules\\@angular\\common\\bundles\\common.umd.js', existingPath: 'C:\\projectpath\\node_modules\\@angular\\common\\bundles\\common.umd.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/tns-core-modules/ui/gestures/gestures.js', expectedResult: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\gestures\\gestures.android.js', existingPath: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\gestures\\gestures.android.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/tns-core-modules/ui/frame/fragment.transitions.js', expectedResult: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\frame\\fragment.transitions.android.js', existingPath: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\frame\\fragment.transitions.android.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/tns-core-modules/debugger/devtools-elements.common.js', expectedResult: 'C:\\projectpath\\node_modules\\tns-core-modules\\debugger\\devtools-elements.common.js', existingPath: 'C:\\projectpath\\node_modules\\tns-core-modules\\debugger\\devtools-elements.common.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/tns-core-modules/ui/page/page.js', expectedResult: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\page\\page.android.js', existingPath: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\page\\page.android.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/tns_modules/tns-core-modules/ui/layouts/layout-base.js', expectedResult: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\layouts\\layout-base.android.js', existingPath: 'C:\\projectpath\\node_modules\\tns-core-modules\\ui\\layouts\\layout-base.android.js' },
    { platform: 'android', scriptUrl: 'ng:///css/0/data/data/org.nativescript.TabNavigation/files/app/tabs/tabs.component.scss.ngstyle.js', expectedResult: 'ng:///css/0/data/data/org.nativescript.TabNavigation/files/app/tabs/tabs.component.scss.ngstyle.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/main.js', expectedResult: 'C:\\projectpath\\src\\main.js', nsconfig: { appPath: 'src' },  existingPath: 'C:\\projectpath\\src\\main.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.TabNavigation/files/app/app/main.js', expectedResult: 'C:\\projectpath\\src\\app\\main.js', nsconfig: { appPath: 'src' },  existingPath: 'C:\\projectpath\\src\\app\\main.js' },
    { platform: 'android', scriptUrl: 'file:///data/data/org.nativescript.app1/files/app/app/main.js', expectedResult: 'C:\\projectpath\\src\\app\\main.js', nsconfig: { appPath: 'src' },  existingPath: 'C:\\projectpath\\src\\app\\main.js' },
];

export = tests;
