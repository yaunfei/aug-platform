import type { ChildProcess } from 'child_process';
interface IOpts {
    scriptPath: string;
}
export default function start({ scriptPath }: IOpts): {
    readonly child: ChildProcess;
    stop(signal: NodeJS.Signals): Promise<void>;
};
export {};
