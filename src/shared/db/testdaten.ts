/*
 * Copyright (C) 2020 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul enthält Funktionen für den DB-Zugriff einschließlich GridFS und
 * Neuladen der Test-DB.
 * @packageDocumentation
 */

import type { AutoData } from '../../auto/entity';

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Die Testdaten, um die Test-DB neu zu laden, als JSON-Array.
 */
export const testdaten: AutoData[] = [
    {
        _id: '00000000-0000-0000-0000-000000000001',
        modell: 'Alpha',
        rating: 4,
        art: 'DRUCKAUSGABE',
        produzent: 'FOO_PRODUZENT',
        preis: 11.1,
        rabatt: 0.011,
        lieferbar: true,
        // https://docs.mongodb.com/manual/reference/method/Date
        datum: new Date('2020-02-01'),
        seriennummer: '978-3897225831',
        homepage: 'https://acme.at/',
        schlagwoerter: ['JAVASCRIPT'],
        produktionswerke: [
            {
                nachname: 'Alpha',
                vorname: 'Adriana',
            },
            {
                nachname: 'Alpha',
                vorname: 'Alfred',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000002',
        modell: 'Beta',
        rating: 2,
        art: 'KINDLE',
        produzent: 'BAR_PRODUZENT',
        preis: 22.2,
        rabatt: 0.022,
        lieferbar: true,
        datum: new Date('2020-02-02'),
        seriennummer: '978-3827315526',
        homepage: 'https://acme.biz/',
        schlagwoerter: ['TYPESCRIPT'],
        produktionswerke: [
            {
                nachname: 'Beta',
                vorname: 'Brunhilde',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000003',
        modell: 'Gamma',
        rating: 1,
        art: 'DRUCKAUSGABE',
        produzent: 'FOO_PRODUZENT',
        preis: 33.3,
        rabatt: 0.033,
        lieferbar: true,
        datum: new Date('2020-02-03'),
        seriennummer: '978-0201633610',
        homepage: 'https://acme.com/',
        schlagwoerter: ['JAVASCRIPT', 'TYPESCRIPT'],
        produktionswerke: [
            {
                nachname: 'Gamma',
                vorname: 'Claus',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000004',
        modell: 'Delta',
        rating: 3,
        art: 'DRUCKAUSGABE',
        produzent: 'BAR_PRODUZENT',
        preis: 44.4,
        rabatt: 0.044,
        lieferbar: true,
        datum: new Date('2020-02-04'),
        seriennummer: '978-0387534046',
        homepage: 'https://acme.de/',
        schlagwoerter: [],
        produktionswerke: [
            {
                nachname: 'Delta',
                vorname: 'Dieter',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000005',
        modell: 'Epsilon',
        rating: 2,
        art: 'KINDLE',
        produzent: 'FOO_PRODUZENT',
        preis: 55.5,
        rabatt: 0.055,
        lieferbar: true,
        datum: new Date('2020-02-05'),
        seriennummer: '978-3824404810',
        homepage: 'https://acme.es/',
        schlagwoerter: ['TYPESCRIPT'],
        produktionswerke: [
            {
                nachname: 'Epsilon',
                vorname: 'Elfriede',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];
Object.freeze(testdaten);

/* eslint-enable @typescript-eslint/naming-convention */
