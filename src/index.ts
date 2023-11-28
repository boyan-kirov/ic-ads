import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
import { v4 as uuidv4 } from 'uuid';

enum AdStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
    BOUGHT = 'BOUGHT',
}

type Ad = Record<{
    id: string;
    owner: string;
    itemType: string;
    itemDescription: string;
    bids: Vec<Bid>;
    status: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
}>;

type Bid = Record<{
    bidder: string;
    amount: number;
}>;

type CreateAdPayload = Record<{
    itemType: string;
    itemDescription: string;
}>;

type UpdateAdPayload = Record<{
    itemType: string;
    itemDescription: string;
    status: string;
}>;

const adStorage = new StableBTreeMap<string, Ad>(0, 44, 1024);

$update;
export function createAd(payload: CreateAdPayload): Result<Ad, string> {
    const ad: Ad = {
        id: uuidv4(),
        owner: uuidv4(),
        bids: [],
        status: AdStatus.OPEN,
        createdAt: ic.time(),
        updatedAt: Opt.None,
        ...payload,
    };
    adStorage.insert(ad.id, ad);
    return Result.Ok(ad);
}

$update;
export function updateAd(id: string, owner: string, payload: UpdateAdPayload): Result<Ad, string> {
    return match(adStorage.get(id), {
        Some: (ad) => {
            if (ad.owner !== owner) return Result.Err<Ad, string>('Only the owner can edit the ad!');
            if (payload.status && !(payload.status in AdStatus))
                return Result.Err<Ad, string>(
                    `Invalid status! Allowed statuses are ${Object.values(AdStatus).join(', ')}`
                );

            const updatedAd: Ad = {
                ...ad,
                itemType: payload.itemType || ad.itemType,
                itemDescription: payload.itemDescription || ad.itemDescription,
                status: payload.status || ad.status,
                updatedAt: Opt.Some(ic.time()),
            };
            adStorage.insert(ad.id, updatedAd);
            return Result.Ok<Ad, string>(updatedAd);
        },
        None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
    });
}

$update;
export function deleteAd(id: string, owner: string): Result<Ad, string> {
    return match(adStorage.get(id), {
        Some: (ad) => {
            if (ad.owner !== owner) return Result.Err<Ad, string>('Only the owner can delete the ad!');
            adStorage.remove(id);
            return Result.Ok<Ad, string>(ad);
        },
        None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
    });
}

$update;
export function bidOnAd(id: string, bidder: string, amount: number): Result<Ad, string> {
    return match(adStorage.get(id), {
        Some: (ad) => {
            if (ad.status !== AdStatus.OPEN) return Result.Err<Ad, string>('Ad is no longer open');
            if (ad.owner === bidder) return Result.Err<Ad, string>("You can't bid on your own ad!");
            if (ad.bids.find((bid) => bid.bidder === bidder))
                return Result.Err<Ad, string>(`${bidder} has already bid on this ad!`);
            ad.bids.push({
                bidder,
                amount,
            });
            adStorage.insert(ad.id, ad);
            return Result.Ok<Ad, string>(ad);
        },
        None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
    });
}

$query;
export function getAllAds(): Result<Vec<Ad>, string> {
    return Result.Ok(adStorage.values());
}

$query;
export function getAdByID(id: string): Result<Ad, string> {
    return match(adStorage.get(id), {
        Some: (ad) => Result.Ok<Ad, string>(ad),
        None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found!`),
    });
}

$query;
export function getAdsByOwner(owner: string): Result<Vec<Ad>, string> {
    try {
        const ads = adStorage.values().filter((ad) => ad.owner === owner);
        return ads.length > 0 ? Result.Ok(ads) : Result.Err(`No ads found for ${owner}`);
    } catch (e) {
        return Result.Err(`Failed to retrieve ads for owner ${owner}!`);
    }
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};
