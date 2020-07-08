/**
 * Cocos Creator 编辑器命名空间
 */
declare namespace Editor {

    /**
     * Log the normal message and show on the console. The method will send ipc message editor:console-log to all windows.
     * @param args Whatever arguments the message needs
     */
    function log(...args: any): void;

    /**
     * Log the normal message and show on the console. The method will send ipc message editor:console-log to all windows.
     * @param args Whatever arguments the message needs
     */
    function info(...args: any): void;

    /**
     * Log the warnning message and show on the console, it also shows the call stack start from the function call it. The method will send ipc message editor:console-warn to all windows.
     * @param args Whatever arguments the message needs
     */
    function warn(...args: any): void;

    /**
     * Log the error message and show on the console, it also shows the call stack start from the function call it. The method will sends ipc message editor:console-error to all windows.
     * @param args Whatever arguments the message needs
     */
    function error(...args: any): void;

    /**
     * Log the success message and show on the console The method will send ipc message editor:console-success to all windows.
     * @param args Whatever arguments the message needs
     */
    function success(...args: any): void;

    /**
     * Require the module by Editor.url. This is good for module exists in package, since the absolute path of package may be variant in different machine.
     * @param url 
     */
    function require(url: string): any;

    /**
     * Returns the file path (if it is registered in custom protocol) or url (if it is a known public protocol).
     * @param url 
     * @param encode 
     */
    function url(url: string, encode?: string): string;

    namespace Project {

        /**
         * Absolute path for current open project.
         */
        readonly let path: string;

        readonly let name: string;

        readonly let id: string;
    }

    namespace Builder {

        /**
         * 
         * @param eventName The name of the event
         * @param callback The event callback
         */
        function on(eventName: string, callback: (options: Options, cb: Function) => void): void;

        /**
         * 
         * @param eventName The name of the event
         * @param callback The event callback
         */
        function once(eventName: string, callback: (options: Options, cb: Function) => void): void;

        /**
         * 
         * @param eventName The name of the event
         * @param callback The event callback
         */
        function removeListener(eventName: string, callback: Function): void;

    }

    namespace Panel {

        /**
         * Open a panel via panelID.
         * @param panelID The panel ID
         * @param argv 
         */
        function open(panelID: string, argv?: object): void;

        /**
         * Close a panel via panelID.
         * @param panelID The panel ID
         */
        function close(panelID: string): void;

        /**
         * Find panel frame via panelID.
         * @param panelID The panel ID
         */
        function find(panelID: string): void;

        /**
         * Extends a panel.
         * @param proto 
         */
        function extend(proto: object): void;

    }

    namespace Ipc {

        /**
         * Send message with ...args to main process asynchronously. It is possible to add a callback as the last or the 2nd last argument to receive replies from the IPC receiver.
         * @param message Ipc message.
         * @param args Whatever arguments the message needs.
         * @param callback You can specify a callback function to receive IPC reply at the last or the 2nd last argument.
         * @param timeout You can specify a timeout for the callback at the last argument. If no timeout specified, it will be 5000ms.
         */
        function sendToMain(message: string, ...args?: any, callback?: Function, timeout?: number): void;

        /**
         * Send message with ...args to panel defined in renderer process asynchronously. It is possible to add a callback as the last or the 2nd last argument to receive replies from the IPC receiver.
         * @param panelID Panel ID.
         * @param message Ipc message.
         * @param args Whatever arguments the message needs.
         * @param callback You can specify a callback function to receive IPC reply at the last or the 2nd last argument.
         * @param timeout You can specify a timeout for the callback at the last argument. If no timeout specified, it will be 5000ms.
         */
        function sendToPanel(panelID: string, message: string, ...args?: any, callback?: Function, timeout?: number): void;

        /**
         * Send message with ...args to all opened window and to main process asynchronously.
         * @param message Ipc message.
         * @param args Whatever arguments the message needs.
         * @param option You can indicate the last argument as an IPC option by Editor.Ipc.option({...}).
         */
        function sendToAll(message: string, ...args?: any, option?: object): void;

        /**
         * Send message with ...args to main process synchronized and return a result which is responded from main process.
         * @param message Ipc message.
         * @param args Whatever arguments the message needs.
         */
        function sendToMainSync(message: string, ...args?: any): void;

        /**
         * Send message with ...args to main process by package name and the short name of the message.
         * @param pkgName Package name.
         * @param message Ipc message.
         * @param args Whatever arguments the message needs.
         */
        function sendToPackage(pkgName: string, message: string, ...args?: any): void;

    }

    /**
     * AssetDB 实例
     */
    export class assetdb {

        /**
         * Get native file path by url.
         */
        static queryPathByUrl(url: string, callback: (err: any, path: any) => void): void;

        /**
         * Get uuid by url.
         */
        static queryUuidByUrl(url: string, callback: (err: any, uuid: any) => void): void;

        /**
         * Get native file path by uuid.
         */
        static queryPathByUuid(uuid: string, callback: (err: any, path: any) => void): void;

        /**
         * Get asset url by uuid.
         */
        static queryUrlByUuid(uuid: string, callback: (err: any, url: any) => void): void;

        /**
         * Get asset info by uuid.
         */
        static queryInfoByUuid(uuid: string, callback: (err: any, info: any) => void): void;

        /**
         * Get meta info by uuid.
         */
        static queryMetaInfoByUuid(uuid: string, callback: (err: any, info: any) => void): void;

        /**
         * Query all assets from asset-db.
         */
        static deepQuery(callback: (err: any, results: any[]) => void): void;

        /**
         * Query assets by url pattern and asset-type.
         */
        static queryAssets(pattern: string, assetTypes: string | string[], callback: (err: any, results: any[]) => void): void;

        /**
         * Import files outside asset-db to specific url folder. 
         */
        static import(rawfiles: string[], destUrl: string, showProgress?: boolean, callback?: (err: any, result: any) => void): void;

        /**
         * Create asset in specific url by sending string data to it.
         */
        static create(url: string, data: string, callback?: (err: any, result: any) => void): void;

        /**
         * Move asset from src to dest.
         */
        static move(srcUrl: string, destUrl: string, showMessageBox?: boolean): void;

        /**
         * Delete assets by url list.
         */
        static delete(urls: string[]): void;

        /**
         * Save specific asset by sending string data.
         */
        static saveExists(url: string, data: string, callback?: (err: any, result: any) => void): void;

        /**
         * Create or save assets by sending string data. If the url is already existed, it will be changed with new data. The behavior is same with method saveExists. Otherwise, a new asset will be created. The behavior is same with method create.
         */
        static createOrSave(url: string, data: string, callback?: (err: any, result: any) => void): void;

        /**
         * Save specific meta by sending meta's json string.
         */
        static saveMeta(uuid: string, metaJson: string, callback?: (err: any, result: any) => void): void;

        /**
         * Refresh the assets in url, and return the results.
         */
        static refresh(url: string, callback?: (err: any, results: any[]) => void): void;

    }

    namespace Selection {

        /**
         * Select item with its id.
         * @param type 
         * @param id 
         * @param unselectOthers 
         * @param confirm 
         */
        function select(type: string, id: string, unselectOthers?: boolean, confirm?: boolean): void;

        /**
         * Unselect item with its id.
         * @param type 
         * @param id 
         * @param confirm 
         */
        function unselect(type: string, id: string, confirm?: boolean): void;

        /**
         * Hover item with its id. If id is null, it means hover out.
         * @param type 
         * @param id 
         */
        function hover(type: string, id: string): string;

        /**
         * 
         * @param type 
         */
        function clear(type: string): void;

        /**
         * 
         * @param type 
         */
        function curActivate(type: string): string[];

        /**
         * 
         * @param type 
         */
        function curGlobalActivate(type: string): string[];

        /**
         * 
         * @param type 
         */
        function curSelection(type: string): string[];

        /**
         * 
         * @param items 
         * @param mode 'top-level', 'deep' and 'name'
         * @param func 
         */
        function filter(items: string[], mode: string, func: Function): string[];

    }

}

interface BuildOptions {
    actualPlatform: string;
    android: { packageName: string };
    'android-instant': {
        REMOTE_SERVER_ROOT: string;
        host: string;
        packageName: string;
        pathPattern: string;
        recordPath: string;
        scheme: string;
        skipRecord: boolean;
    }
    apiLevel: string;
    appABIs: string[];
    appBundle: boolean;
    buildPath: string;
    buildScriptsOnly: boolean;
    debug: string;
    dest: string;
    embedWebDebugger: boolean;
    encryptJs: boolean;
    excludeScenes: string[];
    excludedModules: string[];
    'fb-instant-games': object;
    inlineSpriteFrames: boolean;
    inlineSpriteFrames_native: boolean;
    ios: { packageName: string };
    mac: { packageName: string };
    md5Cache: boolean;
    mergeStartScene: boolean;
    optimizeHotUpdate: boolean;
    orientation: {
        landscapeLeft: boolean;
        landscapeRight: boolean;
        portrait: boolean;
        upsideDown: boolean;
    };
    packageName: string;
    platform: string;
    previewHeight: number;
    previewWidth: number;
    scenes: string[];
    sourceMaps: boolean;
    startScene: string;
    template: string;
    title: string;
    useDebugKeystore: boolean;
    vsVersion: string;
    webOrientation: boolean;
    win32: object;
    xxteaKey: string;
    zipCompressJs: string;
    project: string;
    projectName: string;
    debugBuildWorker: boolean;
    buildResults: any;
}