/*
 * Copyright (C) 2018 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul enthält die _Resolver_ für GraphQL.
 *
 * Die Referenzimplementierung von GraphQL soll übrigens nach TypeScript
 * migriert werden: https://github.com/graphql/graphql-js/issues/2860
 * @packageDocumentation
 */

import {
    BuchInvalid,
    BuchNotExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from './../service/errors';
import { BuchService, BuchServiceError } from '../service';
import type { Buch } from './../entity';
import { logger } from '../../shared';

const autoService = new BuchService();

// https://www.apollographql.com/docs/apollo-server/data/resolvers
// Zugriff auf Header-Daten, z.B. Token
// https://www.apollographql.com/docs/apollo-server/migration-two-dot/#accessing-request-headers
// https://www.apollographql.com/docs/apollo-server/security/authentication

// Resultat mit id (statt _id) und version (statt __v)
// __ ist bei GraphQL fuer interne Zwecke reserviert
const withIdAndVersion = (auto: Buch) => {
    const result: any = auto;
    result.id = auto._id;
    result.version = auto.__v;
    return auto;
};

const findBuchById = async (id: string) => {
    const auto = await autoService.findById(id);
    if (auto === undefined) {
        return;
    }
    return withIdAndVersion(auto);
};

const findAutos = async (titel: string | undefined) => {
    const suchkriterium = titel === undefined ? {} : { titel };
    const autos = await autoService.find(suchkriterium);
    return autos.map((auto: Buch) => withIdAndVersion(auto));
};

interface TitelCriteria {
    titel: string;
}

interface IdCriteria {
    id: string;
}

const createBuch = async (auto: Buch) => {
    const result = await autoService.create(auto);
    logger.debug('resolvers createBuch(): result=%o', result);
    if (result instanceof BuchServiceError) {
        return;
    }
    return result;
};

const logUpdateResult = (
    result:
        | BuchInvalid
        | BuchNotExists
        | TitelExists
        | VersionInvalid
        | VersionOutdated
        | number,
) => {
    if (result instanceof BuchInvalid) {
        logger.debug('resolvers updateBuch(): validation msg = %o', result.msg);
    } else if (result instanceof TitelExists) {
        logger.debug(
            'resolvers updateBuch(): vorhandener titel = %s',
            result.titel,
        );
    } else if (result instanceof BuchNotExists) {
        logger.debug(
            'resolvers updateBuch(): nicht-vorhandene id = %s',
            result.id,
        );
    } else if (result instanceof VersionInvalid) {
        logger.debug(
            'resolvers updateBuch(): ungueltige version = %d',
            result.version,
        );
    } else if (result instanceof VersionOutdated) {
        logger.debug(
            'resolvers updateBuch(): alte version = %d',
            result.version,
        );
    } else {
        logger.debug(
            'resolvers updateBuch(): aktualisierte Version= %d',
            result,
        );
    }
};

const updateBuch = async (auto: Buch) => {
    logger.debug(
        'resolvers updateBuch(): zu aktualisieren = %s',
        JSON.stringify(auto),
    );
    // nullish coalescing
    const version = auto.__v ?? 0;
    const result = await autoService.update(auto, version.toString());
    logUpdateResult(result);
    return result;
};

const deleteBuch = async (id: string) => {
    const result = await autoService.delete(id);
    logger.debug('resolvers deleteBuch(): result = %s', result);
    return result;
};

// Queries passend zu "type Query" in typeDefs.ts
const query = {
    /**
     * Bücher suchen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `titel` als Suchkriterium
     * @returns Promise mit einem JSON-Array der gefundenen Bücher
     */
    autos: (_: unknown, { titel }: TitelCriteria) => findAutos(titel),

    /**
     * Buch suchen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `id` als Suchkriterium
     * @returns Promise mit dem gefundenen {@linkcode Buch} oder `undefined`
     */
    auto: (_: unknown, { id }: IdCriteria) => findBuchById(id),
};

const mutation = {
    /**
     * Neues Buch anlegen
     * @param _ nicht benutzt
     * @param auto JSON-Objekt mit dem neuen {@linkcode Buch}
     * @returns Promise mit der generierten ID
     */
    createBuch: (_: unknown, auto: Buch) => createBuch(auto),

    /**
     * Vorhandenes {@linkcode Buch} aktualisieren
     * @param _ nicht benutzt
     * @param auto JSON-Objekt mit dem zu aktualisierenden Buch
     * @returns Das aktualisierte Buch als {@linkcode BuchData} in einem Promise,
     * falls kein Fehler aufgetreten ist. Ansonsten ein Promise mit einem Fehler
     * durch:
     * - {@linkcode BuchInvalid}
     * - {@linkcode BuchNotExists}
     * - {@linkcode TitelExists}
     * - {@linkcode VersionInvalid}
     * - {@linkcode VersionOutdated}
     */
    updateBuch: (_: unknown, auto: Buch) => updateBuch(auto),

    /**
     * Buch löschen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `id` zur Identifikation
     * @returns true, falls das Buch gelöscht wurde. Sonst false.
     */
    deleteBuch: (_: unknown, { id }: IdCriteria) => deleteBuch(id),
};

/**
 * Die Resolver bestehen aus `Query` und `Mutation`.
 */
export const resolvers /* : IResolvers */ = {
    Query: query, // eslint-disable-line @typescript-eslint/naming-convention
    Mutation: mutation, // eslint-disable-line @typescript-eslint/naming-convention
};
