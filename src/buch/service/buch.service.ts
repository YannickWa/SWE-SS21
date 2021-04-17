/* eslint-disable max-lines */
/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Klasse {@linkcode AuthService} für die
 * Authentifizierung.
 * @packageDocumentation
 */

import type { Buch, BuchData, BuchDocument } from '../entity';
import {
    BuchInvalid,
    BuchNotExists,
    BuchServiceError,
    IsbnExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from './errors';
import { BuchModel, validateBuch } from '../entity';
import type { FilterQuery, QueryOptions } from 'mongoose';
import { cloud, logger, mailConfig } from '../../shared';
import type { SendMailOptions } from 'nodemailer';

// API-Dokumentation zu Mongoose:
// http://mongoosejs.com/docs/api.html
// https://github.com/Automattic/mongoose/issues/3949

/* eslint-disable no-null/no-null, unicorn/no-useless-undefined */

/**
 * Die Klasse `BuchService` implementiert den Anwendungskern für Bücher und
 * greift mit _Mongoose_ auf MongoDB zu.
 */
export class BuchService {
    private static readonly UPDATE_OPTIONS: QueryOptions = { new: true };

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C# und Mono<> aus Project Reactor
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Buch asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Buches
     * @returns Das gefundene Buch vom Typ {@linkcode BuchData} oder undefined
     *          in einem Promise aus ES2015 (vgl.: Mono aus Project Reactor oder
     *          Future aus Java)
     */
    async findById(id: string) {
        logger.debug('BuchService.findById(): id=%s', id);

        // ein Buch zur gegebenen ID asynchron mit Mongoose suchen
        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // Das Resultat ist null, falls nicht gefunden.
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document,
        // so dass u.a. der virtuelle getter "id" auch nicht mehr vorhanden ist.
        const auto = await BuchModel.findById(id).lean<BuchData | null>();
        logger.debug('BuchService.findById(): auto=%o', auto);

        if (auto === null) {
            return undefined;
        }

        this.deleteTimestamps(auto);
        return auto;
    }

    /**
     * Bücher asynchron suchen.
     * @param query Die DB-Query als JSON-Objekt
     * @returns Ein JSON-Array mit den gefundenen Büchern. Ggf. ist das Array leer.
     */
    // eslint-disable-next-line max-lines-per-function
    async find(query?: FilterQuery<BuchDocument> | undefined) {
        logger.debug('BuchService.find(): query=%o', query);

        // alle Autos asynchron suchen u. aufsteigend nach titel sortieren
        // https://docs.mongodb.org/manual/reference/object-id
        // entries(): { titel: 'a', rating: 5 } => [{ titel: 'x'}, {rating: 5}]
        if (query === undefined || Object.entries(query).length === 0) {
            logger.debug('BuchService.find(): alle Autos');
            // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
            const autos = await BuchModel.find()
                .sort('titel')
                .lean<BuchData[]>();
            for await (const auto of autos) {
                this.deleteTimestamps(auto);
            }
            return autos;
        }

        // { titel: 'a', rating: 5, javascript: true }
        // Rest Properties
        const { titel, javascript, typescript, ...dbQuery } = query;

        // Autos zur Query (= JSON-Objekt durch Express) asynchron suchen
        // Titel in der Query: Teilstring des Titels,
        // d.h. "LIKE" als regulaerer Ausdruck
        // 'i': keine Unterscheidung zw. Gross- u. Kleinschreibung
        // NICHT /.../, weil das Muster variabel sein muss
        // CAVEAT: KEINE SEHR LANGEN Strings wg. regulaerem Ausdruck
        if (
            titel !== undefined &&
            titel !== null &&
            typeof titel === 'string' &&
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            titel.length < 10
        ) {
            // RegExp statt Re2 wegen Mongoose
            dbQuery.titel = new RegExp(titel, 'iu'); // eslint-disable-line security/detect-non-literal-regexp, security-node/non-literal-reg-expr
        }

        // z.B. {javascript: true, typescript: true}
        const schlagwoerter = [];
        if (javascript === 'true') {
            schlagwoerter.push('JAVASCRIPT');
        }
        if (typescript === 'true') {
            schlagwoerter.push('TYPESCRIPT');
        }
        if (schlagwoerter.length === 0) {
            delete dbQuery.schlagwoerter;
        } else {
            dbQuery.schlagwoerter = schlagwoerter;
        }

        logger.debug('BuchService.find(): dbQuery=%o', dbQuery);

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // leeres Array, falls nichts gefunden wird
        // BuchModel.findOne(query), falls das Suchkriterium eindeutig ist
        // bei findOne(query) wird null zurueckgeliefert, falls nichts gefunden
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
        const autos = await BuchModel.find(dbQuery).lean<BuchData[]>();
        for await (const auto of autos) {
            this.deleteTimestamps(auto);
        }

        return autos;
    }

    /**
     * Ein neues Buch soll angelegt werden.
     * @param auto Das neu abzulegende Buch
     * @returns Die ID des neu angelegten Buches oder im Fehlerfall
     * - {@linkcode BuchInvalid} falls die Buchdaten gegen Constraints verstoßen
     * - {@linkcode IsbnExists} falls die ISBN-Nr bereits existiert
     * - {@linkcode TitelExists} falls der Titel bereits existiert
     */
    async create(
        auto: Buch,
    ): Promise<BuchInvalid | IsbnExists | TitelExists | string> {
        logger.debug('BuchService.create(): auto=%o', auto);
        const validateResult = await this.validateCreate(auto);
        if (validateResult instanceof BuchServiceError) {
            return validateResult;
        }

        const autoModel = new BuchModel(auto);
        const saved = await autoModel.save();
        const id = saved._id as string; // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
        logger.debug('BuchService.create(): id=%s', id);

        await this.sendmail(auto);

        return id;
    }

    /**
     * Ein vorhandenes Buch soll aktualisiert werden.
     * @param auto Das zu aktualisierende Buch
     * @param versionStr Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall
     *  - {@linkcode BuchInvalid}, falls Constraints verletzt sind
     *  - {@linkcode BuchNotExists}, falls das Buch nicht existiert
     *  - {@linkcode TitelExists}, falls der Titel bereits existiert
     *  - {@linkcode VersionInvalid}, falls die Versionsnummer ungültig ist
     *  - {@linkcode VersionOutdated}, falls die Versionsnummer nicht aktuell ist
     */
    async update(
        auto: Buch,
        versionStr: string,
    ): Promise<
        | BuchInvalid
        | BuchNotExists
        | TitelExists
        | VersionInvalid
        | VersionOutdated
        | number
    > {
        logger.debug('BuchService.update(): auto=%o', auto);
        logger.debug('BuchService.update(): versionStr=%s', versionStr);

        const validateResult = await this.validateUpdate(auto, versionStr);
        if (validateResult instanceof BuchServiceError) {
            return validateResult;
        }

        // findByIdAndReplace ersetzt ein Document mit ggf. weniger Properties
        const autoModel = new BuchModel(auto);
        // Weitere Methoden zum Aktualisieren:
        //    Buch.findOneAndUpdate(update)
        //    auto.updateOne(bedingung)
        const updated = await BuchModel.findByIdAndUpdate(
            auto._id,
            autoModel,
            BuchService.UPDATE_OPTIONS,
        ).lean<BuchData | null>();
        if (updated === null) {
            return new BuchNotExists(auto._id);
        }

        const version = updated.__v as number; // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
        logger.debug('BuchService.update(): version=%d', version);

        return Promise.resolve(version);
    }

    /**
     * Ein Buch wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Buches
     * @returns true, falls das Buch vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: string) {
        logger.debug('BuchService.delete(): id=%s', id);

        // Das Buch zur gegebenen ID asynchron loeschen
        const deleted = await BuchModel.findByIdAndDelete(id).lean();
        logger.debug('BuchService.delete(): deleted=%o', deleted);
        return deleted !== null;

        // Weitere Methoden von mongoose, um zu loeschen:
        //  Buch.findByIdAndRemove(id)
        //  Buch.findOneAndRemove(bedingung)
    }

    private deleteTimestamps(auto: BuchData) {
        delete auto.createdAt;
        delete auto.updatedAt;
    }

    private async validateCreate(auto: Buch) {
        const msg = validateBuch(auto);
        if (msg !== undefined) {
            logger.debug(
                'BuchService.validateCreate(): Validation Message: %o',
                msg,
            );
            return new BuchInvalid(msg);
        }

        // statt 2 sequentiellen DB-Zugriffen waere 1 DB-Zugriff mit OR besser

        const { titel } = auto;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (await BuchModel.exists({ titel })) {
            return new TitelExists(titel);
        }

        const { isbn } = auto;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (await BuchModel.exists({ isbn })) {
            return new IsbnExists(isbn);
        }

        logger.debug('BuchService.validateCreate(): ok');
        return undefined;
    }

    private async sendmail(auto: Buch) {
        if (cloud !== undefined || mailConfig.host === 'skip') {
            // In der Cloud kann man z.B. "@sendgrid/mail" statt
            // "nodemailer" mit lokalem Mailserver verwenden
            return;
        }

        const from = '"Joe Doe" <Joe.Doe@acme.com>';
        const to = '"Foo Bar" <Foo.Bar@acme.com>';
        const subject = `Neues Buch ${auto._id}`;
        const body = `Das Buch mit dem Titel <strong>${auto.titel}</strong> ist angelegt`;

        const data: SendMailOptions = { from, to, subject, html: body };
        logger.debug('sendMail(): data=%o', data);

        try {
            const nodemailer = await import('nodemailer'); // eslint-disable-line node/no-unsupported-features/es-syntax
            await nodemailer.createTransport(mailConfig).sendMail(data);
        } catch (err: unknown) {
            logger.error(
                'BuchService.create(): Fehler beim Verschicken der Email: %o',
                err,
            );
        }
    }

    private async validateUpdate(auto: Buch, versionStr: string) {
        const result = this.validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        logger.debug('BuchService.validateUpdate(): version=%d', version);
        logger.debug('BuchService.validateUpdate(): auto=%o', auto);

        const validationMsg = validateBuch(auto);
        if (validationMsg !== undefined) {
            return new BuchInvalid(validationMsg);
        }

        const resultTitel = await this.checkTitelExists(auto);
        if (resultTitel !== undefined && resultTitel.id !== auto._id) {
            return resultTitel;
        }

        if (auto._id === undefined) {
            return new BuchNotExists(undefined);
        }

        const resultIdAndVersion = await this.checkIdAndVersion(
            auto._id,
            version,
        );
        if (resultIdAndVersion !== undefined) {
            return resultIdAndVersion;
        }

        logger.debug('BuchService.validateUpdate(): ok');
        return undefined;
    }

    private validateVersion(versionStr: string | undefined) {
        if (versionStr === undefined) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                'BuchService.validateVersion(): VersionInvalid=%o',
                error,
            );
            return error;
        }

        const version = Number.parseInt(versionStr, 10);
        if (Number.isNaN(version)) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                'BuchService.validateVersion(): VersionInvalid=%o',
                error,
            );
            return error;
        }

        return version;
    }

    private async checkTitelExists(auto: Buch) {
        const { titel } = auto;

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        const result = await BuchModel.findOne({ titel }, { _id: true }).lean();
        if (result !== null) {
            const id = result._id;
            logger.debug('BuchService.checkTitelExists(): _id=%s', id);
            return new TitelExists(titel, id);
        }

        logger.debug('BuchService.checkTitelExists(): ok');
        return undefined;
    }

    private async checkIdAndVersion(id: string, version: number) {
        const autoDb: BuchData | null = await BuchModel.findById(id).lean();
        if (autoDb === null) {
            const result = new BuchNotExists(id);
            logger.debug(
                'BuchService.checkIdAndVersion(): BuchNotExists=%o',
                result,
            );
            return result;
        }

        // nullish coalescing
        const versionDb = autoDb.__v ?? 0;
        if (version < versionDb) {
            const result = new VersionOutdated(id, version);
            logger.debug(
                'BuchService.checkIdAndVersion(): VersionOutdated=%o',
                result,
            );
            return result;
        }

        return undefined;
    }
}
/* eslint-enable no-null/no-null, unicorn/no-useless-undefined */
/* eslint-enable max-lines */
