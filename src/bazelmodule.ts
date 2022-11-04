import { QuickPickItem } from "vscode";

export interface BazelModule {
    path: string;
    name?: string;
    selected: boolean;
    nested?: BazelModule[];
}

export class BazelModuleQuickPickItem implements QuickPickItem {
    label: string;

    constructor(public readonly module: BazelModule) {
        this.label = module.path;
    }
}