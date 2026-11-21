import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { planningItemsRouter } from "./items";
import { planningSubcategoriesRouter } from "./subcategories";
import { byName, loadPeople } from "./people";

export const adminPlanningRouter = router({
  items: planningItemsRouter,
  subcategories: planningSubcategoriesRouter,
  admins: router({
    list: adminProcedure
      .meta({
        description: "List the admins a planning item can be assigned to",
      })
      .query(async () => {
        const admins = await Q.admin.findAll({});
        const person = await loadPeople(admins.map((a) => a.discordId));

        return {
          admins: admins.map((a) => person(a.discordId)).sort(byName),
        };
      }),
  }),
});
