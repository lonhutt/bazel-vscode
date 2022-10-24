import * as path from 'path';
import * as fs from 'fs';
import { BazelModule } from './bazelmodule';
import * as vscode from 'vscode';

const WORKSPACE_NAME = 'workspace.code-workspace';

export class VsCodeWorkspace {
    folders: VsCodePath[];
    settings: {[key:string]: any};
    constructor(modules: BazelModule[]) {
        const selectedModules = modules.filter(m=>m.selected);
        this.folders = selectedModules.map(p => { return {path: p.path}; });

        const excludeConfig: ExcludeConfig = {};
        excludeConfig[`**/{${selectedModules.map(m=>m.path).join(',')}}`] = true;

        this.settings = {};
        this.settings['files.exclude'] = excludeConfig;
        this.settings['java.configuration.updateBuildConfiguration'] = 'automatic';
    }

    public write(folder: string) {
        this.folders.push({path: vscode.workspace.asRelativePath(folder)});
        this.folders = this.folders.sort();
        const vscodeWorkspace = path.join(folder, WORKSPACE_NAME);
        const content: string = JSON.stringify(this, null, 2);

        fs.writeFileSync(vscodeWorkspace, content);
    }
}

interface VsCodePath {
   path: string;
   name?: string;
}

interface ExcludeConfig {
	[key: string]: boolean;
}