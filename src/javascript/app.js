Ext.define("TSAuditReport", {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    scopeType: 'iteration',
    comboboxConfig: {
        fieldLabel: 'Select an Iteration:',
        labelWidth: 100,
        width: 300
    },
    onScopeChange: function() {
			this._MakeGrid();
	},
    _MakeGrid: function() {
        var me = this;
        this.setLoading("Loading Data...");
        
        this._getHistory('HierarchicalRequirement').then({
            scope: this,
            success: function(records) {
                if (records.length > 0) {
                this._assignUsersToRecords(records).then({
                    scope: this,
                    success:function(records) {
                        var store = this._createStore(records);
                        this._displayGrid(store);
                    },
                    failure: function(error_message) {
                        alert(error_message);
                    }
                });
            } else {
                this.setLoading(false);
                alert("No Records Found");
                return;
        }
                
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            
        });
    },
    _assignUsersToRecords: function(records) {
        var deferred = Ext.create('Deft.Deferred');
        var users_to_check = [];
        var me = this;
        
        Ext.Array.each(records, function(record) {
            var user = record.get('_User');
            var user_filter = { property:'ObjectID', value: user };
            
            users_to_check = Ext.Array.merge(users_to_check,[user]);
            
        });
        var user_filter = Ext.Array.map(users_to_check, function(u) {
            return { property:'ObjectID', value: u };
        });
        Ext.create('Rally.data.wsapi.Store',{
            model: 'User',
            filters:Rally.data.wsapi.Filter.or(user_filter),
            fetch: ['_refObjectName','UserName','Role']
        }).load({
            callback : function(users, operation, successful) {
                if (successful){
                    var user_hash = {};
                    Ext.Array.each(users, function(user) {
                        user_hash[user.get('ObjectID')] = user;
                    });
                    
                    Ext.Array.each(records, function(record){
                        record.set('__UserObject', user_hash[record.get('_User')]);
                    });
                    
                    deferred.resolve(records);
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });        
        return deferred.promise;
    },
    _createStore: function(records) {
        var store = Ext.create('Rally.data.custom.Store',{
            data: records
        });
        return store;
    },
    _getHistory: function(model_name){
        var iOID = null;
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        if (this.getContext().getTimeboxScope().getRecord() != null) {
        iOID = me.getContext().getTimeboxScope().getRecord().get("ObjectID");
        }
        Ext.create('Rally.data.lookback.SnapshotStore', {
            filters: [
                {property: '_TypeHierarchy', operator: 'in', value: ['HierarchicalRequirement']},
                {property: '_ProjectHierarchy', value: me.getContext().getProject().ObjectID },
                { property: "_PreviousValues.ScheduleState", operator: "exists", value: true },
                { property: "ScheduleState", operator: '=', value: "Accepted" },
                { property: "Iteration", value: iOID }
            ],
            fetch: ['_User','ScheduleState','_PreviousValues.ScheduleState','ObjectID','FormattedID','Name','Iteration'],
            hydrate: ['ScheduleState','_PreviousValues.ScheduleState','Iteration']
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    _displayGrid: function(store){
        var columns = [
            { dataIndex: 'FormattedID', text: 'id' },
            { dataIndex: 'Name', text: 'id', flex: 1 },
            { dataIndex: '_PreviousValues.ScheduleState', text: 'From State', renderer: function(value) {
                if ( !value ) {
                    return "No Previous State";
                }
                return value;
            } },

            { dataIndex: 'ScheduleState', text: 'Into State' },
            { dataIndex: '__UserObject', text: 'Who', renderer: function(value, meta_data, record) {
                if ( !value ) {
                    meta_data.tdCls = 'red';
                    return '--';
                }
                if ( !value.get('_refObjectName') ) {
                    meta_data.tdCls = "yellow";
                    return '--';
                }
                
                return value.get('_refObjectName');
            } },
            {dataIndex: '__UserObject', text: 'Role', renderer: function(value, meta_data, record) {
                return value.get('Role');
            } },
            { dataIndex: '_ValidFrom', text: 'When', renderer: function(value) {
                if ( !value ) { return "--"; }
                var display_value = Rally.util.DateTime.fromIsoString(value);
                return Ext.util.Format.date(display_value, 'Y-m-d');
            } }
        ];
    if (this._grid) this._grid.destroy();
    this._grid = this.add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: columns
        });
        
        this.setLoading(false);
    }
});
