import { PathVerb } from '../constant';
import { Point } from './point';
export declare class Path {
    verbs: Array<PathVerb>;
    points: Array<Point>;
    close(): void;
    reverse(): void;
    clear(): void;
    interpolate(_path: Path, _result: Path, _t: number): void;
}
