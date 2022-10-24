export interface BazelModule {
    path: string;
    name?: string;
    selected: boolean;
    nested?: BazelModule[];
}