import { createBusinessProfile } from './profileFactory';
import { restauranteProfile } from './restaurante';
import { cafeteriaProfile } from './cafeteria';
import { panaderiaProfile } from './panaderia';

export const businessProfiles = {
  general: createBusinessProfile({
    id: 'general',
    name: 'Tienda general / minimarket',
    businessType: 'general',
    description: 'Perfil base para tiendas, minimarkets y negocios de productos variados.',
  }),

  ropa: createBusinessProfile({
    id: 'ropa',
    name: 'Tienda de ropa',
    businessType: 'ropa',
    description: 'Perfil para boutiques y tiendas que manejan tallas, colores y marcas.',
    labels: {
      products: 'Prendas',
      inventory: 'Inventario de ropa',
      sales: 'Ventas de ropa',
    },
    modules: {
      clothingVariants: true,
      recipes: false,
      ingredients: false,
      foodSales: false,
      tables: false,
    },
    productFields: {
      brand: true,
      size: true,
      color: true,
      expirationDate: false,
      batchNumber: false,
      recipe: false,
      ingredients: false,
    },
  }),

  cafeteria: cafeteriaProfile,

  restaurante: restauranteProfile,

  panaderia: panaderiaProfile,

  ferreteria: createBusinessProfile({
    id: 'ferreteria',
    name: 'Ferretería / repuestos',
    businessType: 'ferreteria',
    description: 'Perfil para ferreterías, repuestos, herramientas y productos por medida.',
  }),

  taller: createBusinessProfile({
    id: 'taller',
    name: 'Taller / servicios',
    businessType: 'taller',
    description: 'Perfil para talleres que manejan repuestos, servicios y mano de obra.',
  }),

  otro: createBusinessProfile({
    id: 'otro',
    name: 'Otro negocio',
    businessType: 'otro',
    description: 'Perfil flexible para negocios que no encajan en los rubros anteriores.',
  }),
};

export function getBusinessProfile(profileId = 'general') {
  return businessProfiles[profileId] || businessProfiles.general;
}

export function getBusinessProfileOptions() {
  return Object.values(businessProfiles).map((profile) => ({
    value: profile.id,
    label: profile.name,
    businessType: profile.businessType,
    description: profile.description,
  }));
}
