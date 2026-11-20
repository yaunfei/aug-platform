export declare function consumeHmrSubscription<Result extends {
    type: string;
}>(subscription: AsyncIterable<Result>, onResult: (result: Result) => void, onUpdate: (result: Result) => void): Promise<void>;
